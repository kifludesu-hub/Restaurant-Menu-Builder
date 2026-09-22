# DESU Digital Menu Builder — Vercel + Supabase + Chapa

A deployable starter SaaS for restaurants to create QR-code menus, manage menu categories/items, publish public menus, and pay for BASIC/PRO subscriptions through Chapa.

## Architecture

Browser -> Vercel static frontend
Browser -> Supabase Auth/Postgres/Storage
Browser -> Vercel `/api/chapa/*` -> Chapa
Vercel Chapa functions -> Supabase using the server secret

Vercel Functions run server-side without a traditional server. Keep the Chapa secret and Supabase server secret out of browser code.

## 1. Create Supabase project

Create a project at https://supabase.com/dashboard

Open SQL Editor and run:

`sql/schema.sql`

Then open Project Settings -> API and copy:
- Project URL
- Publishable key (or the current client key shown by your project)

Put those into `js/config.js`.

IMPORTANT: the browser key is allowed in the frontend only because RLS policies protect the tables. Never put the Supabase service-role/secret key in `js/config.js`.

## 2. Configure Supabase Auth

For the easiest first deployment, enable Email/Password in Supabase Authentication.

If email confirmation is enabled, a new restaurant must confirm its email before the dashboard can be used.

## 3. Configure Vercel environment variables

In Vercel Project Settings -> Environment Variables add:

SUPABASE_URL = your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY = your server-side Supabase secret/service-role key
CHAPA_SECRET_KEY = your Chapa test or live secret key

Do NOT commit these values to GitHub.

Redeploy after changing environment variables.

## 4. Chapa

Create/configure your Chapa account and use sandbox/test mode first.

The code:
- creates a pending payment row
- initializes Chapa
- sends the restaurant owner to Chapa checkout
- receives the callback
- verifies the transaction with Chapa
- checks amount/currency
- activates the restaurant subscription for one month

Before production, test the complete payment flow and confirm your Chapa account's current callback/return requirements.

## 5. Deploy

Push this folder to GitHub.

Import the repository into Vercel.

Because this is a static HTML/CSS/JS project with `/api` Vercel Functions, no frontend framework is required.

## 6. URLs

Home:
/

Signup:
/signup.html

Login:
/login.html

Dashboard:
/dashboard.html

Public menu:
/m/restaurant-slug

Admin:
/admin.html

## 7. Create an admin

After creating your own account, find your Auth user UUID in Supabase Authentication -> Users.

Run:

`update public.profiles set role='admin' where id='YOUR_UUID';`

Then open `/admin.html`.

## 8. Food images

The current dashboard implements menu data management and the public menu supports image URLs. The next production enhancement is a dashboard image-upload control that calls:

`supabase.storage.from('menu-images').upload(...)`

and then saves the returned public URL into `menu_items.image_url`.

The Storage bucket and policies are already created by `schema.sql`.

## 9. Security

The project uses Supabase Row Level Security. Public customers can read published menu data, while restaurant owners can only write rows belonging to their own restaurant.

Payment initialization and verification happen in Vercel server functions, where the Chapa secret is kept private.

Before a commercial launch, add:
- rate limiting
- stronger ownership checks for all admin operations
- subscription expiry automation
- audit logs
- image type/size validation
- abuse protection
- backups and monitoring
- production payment testing
- terms/privacy pages

## 10. Important deployment note

This is a real deployable MVP foundation, not a claim that every production business requirement is finished. You must configure your own Supabase and Chapa accounts/keys, test the payment provider, and review security before charging real customers.
