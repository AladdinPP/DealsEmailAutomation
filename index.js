const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
require('dotenv').config();

// --- Supabase Setup ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: Supabase credentials not found. Please create a .env file and add SUPABASE_URL and SUPABASE_ANON_KEY.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const dealDataPath = path.join(__dirname, 'deal_data.json');
const userDataPath = path.join(__dirname, 'user_data.json');
const emailTemplatePath = path.join(__dirname, 'emailTemplate.html');

/**
 * Loads and parses JSON data from a given file path.
 * @param {string} filePath - The path to the JSON file.
 * @returns {Array} - The parsed JSON data.
 */
function loadJsonData(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error loading data from ${filePath}:`, err);
        return [];
    }
}

/**
 * Ingests deal and user data into the Supabase database.
 */
async function ingestData() {
    console.log('Ingesting deal data into Supabase...');

    const dealsToIngest = loadJsonData(dealDataPath);
    const usersToIngest = loadJsonData(userDataPath);

    // Ingest Retailers and Products
    for (const deal of dealsToIngest) {
        // Upsert retailer, ignoring duplicates
        const { data: retailer, error: retailerError } = await supabase
            .from('retailers')
            .upsert({ name: deal.retailer }, { onConflict: 'name' })
            .select()
            .single();

        if (retailerError && retailerError.code !== '23505') { // 23505 is duplicate key error
            console.error('Error upserting retailer:', retailerError);
            continue;
        }

        const retailerId = retailer ? retailer.id : (await supabase.from('retailers').select('id').eq('name', deal.retailer).single()).data.id;

        // Upsert product, ignoring duplicates
        const { data: product, error: productError } = await supabase
            .from('products')
            .upsert({ name: deal.product, size: deal.size, category: deal.category }, { onConflict: 'name' })
            .select()
            .single();

        if (productError && productError.code !== '23505') {
            console.error('Error upserting product:', productError);
            continue;
        }

        const productId = product ? product.id : (await supabase.from('products').select('id').eq('name', deal.product).single()).data.id;

        // Check for existing deal to prevent duplicates
        const { data: existingDeal } = await supabase
            .from('deals')
            .select('id')
            .eq('retailer_id', retailerId)
            .eq('product_id', productId)
            .eq('start_date', deal.start)
            .single();

        if (!existingDeal) {
            // Insert new deal
            const { error: dealError } = await supabase
                .from('deals')
                .insert({
                    retailer_id: retailerId,
                    product_id: productId,
                    price: deal.price,
                    start_date: deal.start,
                    end_date: deal.end,
                });

            if (dealError) {
                console.error('Error inserting deal:', dealError);
            }
        }
    }

    // Ingest Users
    for (const user of usersToIngest) {
        // Get retailer IDs for preferred retailers
        const { data: preferredRetailers } = await supabase
            .from('retailers')
            .select('id')
            .in('name', user.preferred_retailers);

        const preferredRetailerIds = preferredRetailers.map(r => r.id);

        // Upsert user, ignoring duplicates
        const { error: userError } = await supabase
            .from('users')
            .upsert({
                email: user.email,
                preferred_retailer_ids: preferredRetailerIds
            }, { onConflict: 'email' });

        if (userError) {
            console.error('Error upserting user:', userError);
        }
    }

    console.log('Data ingestion complete.');
}

/**
 * Generates and sends mock emails to test recipients with filtered deals.
 */
async function generateAndSendEmails() {
    console.log('Generating and sending emails to test recipients...');

    const { data: users, error: userError } = await supabase
        .from('users')
        .select('email, preferred_retailer_ids');

    if (userError) {
        console.error('Error fetching users:', userError);
        return;
    }

    const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf8');

    for (const user of users) {
        // Fetch deals for the user's preferred retailers
        const { data: deals, error: dealsError } = await supabase
            .from('deals')
            .select('*, retailer:retailer_id(*), product:product_id(*)')
            .in('retailer_id', user.preferred_retailer_ids)
            .order('price', { ascending: true })
            .limit(6);

        if (dealsError) {
            console.error('Error fetching deals for user:', user.email, dealsError);
            continue;
        }

        const emailContent = ejs.render(emailTemplate, { deals });

        // Mock email sending
        console.log(`\n--- Sending email to: ${user.email} ---`);
        console.log('Subject: Your Weekly Deals from Prox');
        console.log('[Mock Email HTML Content]');
    }
}

/**
 * Main function to run the automation script.
 */
async function main() {
    await ingestData();
    await generateAndSendEmails();
    console.log('\nAutomation script finished.');
}

main();