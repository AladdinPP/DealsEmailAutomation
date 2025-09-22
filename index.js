require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

// Load sample data
const sampleDealData = require('./deal_data.json');
const sampleUserData = require('./user_data.json');

// Get the mock email template
const emailTemplate = fs.readFileSync(path.join(__dirname, 'emailTemplate.html'), 'utf-8');

// Initialize Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Generates and "sends" a personalized email to a single user.
 * @param {object} user The user object with their email and preferences.
 * @param {array} allDeals An array of all available deals from the database.
 */
async function generateAndSendEmail(user, allDeals) {
    try {
        // Step 1: Filter deals based on user's preferred retailer IDs.
        const userDeals = allDeals.filter(deal =>
            user.preferred_retailer_ids.includes(deal.retailer.id)
        );

        // Step 2: Sort the filtered deals by price, from lowest to highest.
        userDeals.sort((a, b) => a.price - b.price);

        // Step 3: Select the top 6 deals to feature in the email.
        const topDeals = userDeals.slice(0, 6);

        // Step 4: Render the email template with the personalized deals.
        const emailHtml = ejs.render(emailTemplate, { deals: topDeals, user });

        // Step 5: Send the email using the Resend API.
        // The 'to' field is set to a verified email for testing purposes.
        const { data, error } = await resend.emails.send({
            from: 'Prox Weekly Deals <onboarding@resend.dev>',
            to: 'simonhe1714@gmail.com',
            subject: `Weekly Deals for ${user.email}`,
            html: emailHtml,
        });

        if (error) {
            console.error(`Error sending email to ${user.email}:`, error);
        } else {
            console.log(`Successfully sent email to ${user.email}.`);
        }
    } catch (error) {
        console.error(`Error generating email for ${user.email}:`, error);
    }
}

/**
 * Main function to run the entire automation script.
 * @param {object} supabase The Supabase client object.
 */
async function runAutomation(supabase) {
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
                preferred_retailer_ids
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

        // Check if userData is defined and an array before looping
        if (userData && Array.isArray(userData)) {
            // Use a for...of loop with a delay to avoid rate limiting
            for (const user of userData) {
                await generateAndSendEmail(user, allDeals);
                // Wait for a second to avoid the Resend rate limit
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            console.error("User data is not available or not in the correct format.");
        }

        console.log('\nAutomation script finished.');

    } catch (err) {
        console.error('An error occurred during automation:', err);
        // Exit with an error code
        process.exit(1);
    }
}

// Run the automation script
runAutomation(supabase);