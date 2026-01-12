# 🚀 GhostPass Admin Setup Guide

## Quick Setup (3 Steps)

### Step 1: Run SQL Schema
1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the contents of `backend/admin_schema.sql`
3. Click **Run** to execute the SQL
4. You should see: "GhostPass Admin Schema Setup Complete! ✅"

### Step 2: Register Admin User
1. Start your GhostPass app (frontend + backend)
2. Register a new user account with your admin email
3. Complete the registration process

### Step 3: Promote to Admin
```bash
cd backend
python setup_admin_simple.py
```
Enter your email when prompted.

## 🎉 That's it!

Now login with your admin account and look for the **⚙ ADMIN MODE** toggle in the sidebar.

---

## Alternative: Manual SQL Method

If the Python scripts don't work, you can promote a user to admin manually:

1. Find your user ID in Supabase Dashboard → **Table Editor** → **users** table
2. Run this SQL in **SQL Editor**:
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'your-email@example.com';
```

---

## Troubleshooting

### "Role column doesn't exist"
- Make sure you ran `admin_schema.sql` first
- Check that the SQL executed without errors

### "User not found"
- Register the user through the app first
- Check the email spelling

### "Permission denied"
- Make sure your Supabase key has the right permissions
- Try using the service role key (not anon key)

---

## Files Overview

- `admin_schema.sql` - Database schema (run in Supabase)
- `setup_admin_simple.py` - Simple user promotion script
- `setup_admin.py` - Full setup script (more complex)

Choose the simple version for easier setup!