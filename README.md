## Prox Weekly Deals Automation
This project is an automated system designed to ingest weekly retail deal
data, store it in a minimal database, and send personalized "Weekly Deals"
emails to a list of users based on their preferred retailers.

### Requirements Met
- **Data Layer**: The system now connects to a real PostgreSQL database via 
  the Supabase SDK, persisting data and providing a robust backend. The 
  schema for `retailers`, `products`, `deals`, and `users` is implemented as 
  requested.
- **Email Generation**: HTML emails are generated using a branded template
  and are sent to test recipients. The emails are filtered to show only the
  top 6 lowest-priced deals from the user's preferred retailers.
- **Automation**: A single CLI command, `npm run send:weekly`, orchestrates
  the entire process: data ingestion, email content generation, and mock
  email delivery.
- **Developer Experience**: The codebase is clean, well-commented, and the
  setup is straightforward and reproducible with minimal external dependencies.

### Setup & Installation
To run this project, you need Node.js, npm, and a free Supabase account.
1. Create a Supabase Project: Go to https://supabase.com/dashboard and create 
a new project.
2. Create the Database Schema: Navigate to the SQL Editor in your Supabase 
   project and run the following SQL commands to create the necessary tables.
```sql
CREATE TABLE retailers (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name TEXT NOT NULL,
size TEXT,
category TEXT
);

CREATE TABLE deals (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
retailer_id UUID REFERENCES retailers(id),
product_id UUID REFERENCES products(id),
price NUMERIC(10, 2) NOT NULL,
start_date DATE NOT NULL,
end_date DATE NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
UNIQUE (retailer_id, product_id, start_date)
);

CREATE TABLE users (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
email TEXT NOT NULL UNIQUE,
preferred_retailer_ids UUID[]
);
```

3. Create a .env file: In the root of your project, create a file named .env. 
This file will store your Supabase credentials securely. 
4. Add Credentials to .env: Find your Project URL and anon Key in your 
   Supabase project settings under API. Paste them into your .env file as 
   shown below.
```dotenv
SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
SUPABASE_ANON_KEY=YOUR_SUPABASE_PROJECT_ANON_KEY
```
You will also need to add your Resend API key to this file:

```dotenv
RESEND_API_KEY=YOUR_RESEND_API_KEY
```

5. Install project dependencies: Run the following command from the 
   project's root directory.
>`npm install`

### Usage
Run the following command from the project's root directory to execute the
automation script. This will ingest the data and "send" the emails to the
test users.
> `npm run send:weekly`

The output will be logged to the console, showing the details of the mock
emails being sent.

### Next Steps
With two more days of work, I would focus on turning this proof-of-concept
into a more robust
and production-ready system. My priorities would be:
1. **Deploy as a Scheduled Function**: Use a serverless platform like Vercel or 
   a cloud function (e.g., Google Cloud Functions) to schedule the 
   send:weekly script to run automatically on a weekly basis, completing the 
   automation loop.
2. **Build a simple web scraper**: Create a simple web scraper that fetches 
   deals from one of the retailers' websites. This will automate the data 
   ingestion process instead of relying on manually updated JSON files.