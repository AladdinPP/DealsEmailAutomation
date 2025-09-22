## Prox Weekly Deals Automation
This project is an automated system designed to ingest weekly retail deal
data, store it in a minimal database, and send personalized "Weekly Deals"
emails to a list of users based on their preferred retailers.

### Requirements Met
- **Data Layer**: A minimal, in-memory database schema is implemented within
  the `index.js` file to simulate a real database environment (e.g., Supabase).
- **Email Generation**: HTML emails are generated using a branded template
  and are sent to test recipients. The emails are filtered to show only the
  top 6 lowest-priced deals from the user's preferred retailers.
- **Automation**: A single CLI command, `npm run send:weekly`, orchestrates
  the entire process: data ingestion, email content generation, and mock
  email delivery.
- **Developer Experience**: The codebase is clean, well-commented, and the
  setup is straightforward and reproducible with minimal external dependencies.

### Setup & Installation
To run this project, you need Node.js and npm installed.
1. Clone this repository or create a new directory and save the files.
2. Install project dependencies.
> `npm install`

### Usage
Run the following command from the project's root directory to execute the
automation script. This will ingest the data and "send" the emails to the
test users.
> `npm run send:weekly`

The output will be logged to the console, showing the details of the mock
emails being sent.

### Database Schema
The database is simulated as a simple in-memory object in `index.js` with
the following schema:

`retailers`
- `id` (string): A unique identifier for the retailer.
- `name` (string): The name of the retailer.

`products`
- `id` (string): A unique identifier for the product.
- `name` (string): The name of the product.
- `size` (string): The size or quantity of the product.
- `category` (string): The product category (e.g., "produce").

`deals`
- `id` (string): A unique identifier for the deal.
- `retailer_id` (string): Foreign key linking to a retailer.
- `product_id` (string): Foreign key linking to a product.
- `price` (number): The price of the deal.
- `start_date` (string): The start date of the deal (`YYYY-MM-DD`).
- `end_date` (string): The end date of the deal (`YYYY-MM-DD`).
- `created_at` (Date): The timestamp when the deal was ingested.

`users`
- `id` (string): A unique identifier for the user.
- `email` (string): The user's email address.
- `preferred_retailers` (string[]): An array of retailer names.

### Next Steps
With two more days of work, I would focus on turning this proof-of-concept
into a more robust
and production-ready system. My priorities would be:
1. Migrate to a Real Database: Replace the in-memory database with a proper
   solution like Supabase. This would involve writing actual `INSERT` and
   `SELECT` queries and setting up a secure connection.
2. Implement Resend API Integration: Connect to the Resend API to send real
   emails instead of just logging to the console. This would involve using
   their SDK and handling API keys securely via environment variables.
3. Deploy as a Scheduled Function: Use a serverless platform like Vercel or
   a cloud function (e.g., Google Cloud Functions) to schedule the
   `send:weekly` script to run automatically on a weekly basis, completing the
   automation loop.