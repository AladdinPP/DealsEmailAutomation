// Required modules
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const ejs = require('ejs');
const fs = require('fs');

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const verifiedEmail = process.env.VERIFIED_EMAIL;

// Supabase and Resend client initialization
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const resend = new Resend(resendApiKey);

// Sample data
const sampleDealData = JSON.parse(fs.readFileSync('./deal_data.json', 'utf8'));
const sampleUserData = JSON.parse(fs.readFileSync('./user_data.json', 'utf8'));
const emailTemplate = fs.readFileSync('./emailTemplate.html', 'utf8');

// Function to generate and "send" a personalized email to a single user
async function generateAndSendEmail(user, allDeals) {
    try {
        // Step 1: Filter deals based on user preferences.
        // This is the core personalization logic.
        const userDeals = allDeals.filter(deal =>
            user.preferred_retailer_ids.includes(deal.retailer.id)
        );

        // Step 2: Sort the filtered deals by price, from lowest to highest.
        userDeals.sort((a, b) => a.price - b.price);

        // NOTE: The previous version selected only the top 6 deals.
        // As per the new requirement, we now send all available deals.
        const allFilteredDeals = userDeals;

        // Step 3: Render the email template with the personalized deals.
        const emailHtml = ejs.render(emailTemplate, { deals: allFilteredDeals, user });

        // Step 4: Use Resend API to send the email.
        await resend.emails.send({
            from: 'Prox Weekly Deals <onboarding@resend.dev>',
            to: `simonhe1714@gmail.com`,
            subject: `Weekly Deals for ${user.email}`,
            html: emailHtml,
        });

        // Step 5: Log the "sent" email to the console.
        console.log(`\n--- Sending email to: ${user.email} ---`);
        console.log(`Email sent successfully to ${verifiedEmail} (for ${user.email})`);
    } catch (error) {
        // Log any errors that occur during email generation or sending.
        console.error(`Error sending email for ${user.email}:`, error);
        console.error('Resend API Error:', error.message);
    }
}

// Main function to run the entire automation script.
async function runAutomation() {
    try {
        console.log('Ingesting deal data into Supabase...');

        // Ingest retailers
        const { data: retailerData, error: retailerError } = await supabase
            .from('retailers')
            .upsert(
                sampleDealData.map(deal => ({ name: deal.retailer })),
                { onConflict: 'name' }
            )
            .select();
        if (retailerError) throw retailerError;
        const retailers = new Map(retailerData.map(r => [r.name, r]));

        // Ingest products
        const { data: productData, error: productError } = await supabase
            .from('products')
            .upsert(
                sampleDealData.map(deal => ({ name: deal.product, size: deal.size, category: deal.category })),
                { onConflict: 'name' }
            )
            .select();
        if (productError) throw productError;
        const products = new Map(productData.map(p => [p.name, p]));

        // Ingest deals
        const dealsToInsert = sampleDealData.map(deal => ({
            retailer_id: retailers.get(deal.retailer)?.id,
            product_id: products.get(deal.product)?.id,
            price: deal.price,
            start_date: deal.start,
            end_date: deal.end
        }));

        const { error: dealsError } = await supabase
            .from('deals')
            .upsert(dealsToInsert, { onConflict: ['retailer_id', 'product_id', 'start_date'] });
        if (dealsError) throw dealsError;

        console.log('Data ingestion complete.');

        console.log('\nGenerating and sending emails to test recipients...');

        // Ingest users
        const usersToInsert = sampleUserData.map(user => {
            const preferred_retailer_ids = user.preferred_retailers.map(retailerName =>
                retailers.get(retailerName)?.id
            ).filter(id => id); // Filter out any null or undefined IDs
            return {
                email: user.email,
                preferred_retailer_ids,
            };
        });

        const { data: userData, error: userError } = await supabase
            .from('users')
            .upsert(usersToInsert, { onConflict: 'email' })
            .select();
        if (userError) throw userError;

        // Fetch all deals with their related product and retailer info
        const { data: allDeals, error: dealsFetchError } = await supabase
            .from('deals')
            .select(`
                *,
                retailer:retailer_id (name),
                product:product_id (name, size)
            `);
        if (dealsFetchError) throw dealsFetchError;

        // Fetch users and their preferred retailer IDs
        const { data: users, error: usersFetchError } = await supabase
            .from('users')
            .select('email, preferred_retailer_ids');
        if (usersFetchError) throw usersFetchError;

        // Fetch all retailers to map IDs to names
        const { data: allRetailers, error: retailersFetchError } = await supabase
            .from('retailers')
            .select('id, name');
        if (retailersFetchError) throw retailersFetchError;
        const retailersMap = new Map(allRetailers.map(r => [r.id, r.name]));

        // Process each user's email
        for (const user of users) {
            const preferred_retailers = user.preferred_retailer_ids.map(id => retailersMap.get(id)).filter(name => name);
            await generateAndSendEmail(
                {...user, preferred_retailers},
                allDeals
            );
            // Add a 1-second delay to avoid Resend's rate limit
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\nAutomation script finished.');

    } catch (err) {
        console.error('An error occurred during automation:', err);
    }
}

// Run the main function
runAutomation();