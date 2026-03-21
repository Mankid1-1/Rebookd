# 🧪 TEST ACCOUNT SETUP

## Test Admin Account

**Email**: `brendanjj96@outlook.com`
**Password**: `password1`
**Role**: Administrator (full access)

This account is created automatically when you run:
```bash
./scripts/docker-start.sh init
```

## Login Instructions

1. **Start the application**:
   ```bash
   ./scripts/docker-start.sh up
   ```

2. **Open in browser**:
   ```
   http://localhost:3000
   ```

3. **Click "Sign in"**

4. **Enter credentials**:
   - Email: `brendanjj96@outlook.com`
   - Password: `password1`

5. **Click "Sign in"**

You'll be logged in and can access:
- Dashboard: http://localhost:3000/dashboard
- Leads: http://localhost:3000/leads
- Automations: http://localhost:3000/automations
- Admin Panel: http://localhost:3000/admin
- Settings: http://localhost:3000/settings

## What to Test

### Basic Features
- [ ] Login with test account
- [ ] View dashboard metrics
- [ ] Create a test lead
- [ ] Send test SMS
- [ ] View message history

### Automations
- [ ] Create automation
- [ ] Activate pre-built template
- [ ] View automation logs

### Admin Functions
- [ ] View all tenants (should see "Default Tenant")
- [ ] View system health
- [ ] Check error logs
- [ ] View webhook logs

### API Testing
- [ ] tRPC queries (health check)
- [ ] tRPC mutations (create lead)
- [ ] Webhook endpoints

## Database Access

If you need direct database access for testing:

```bash
# Connect to MySQL container
docker-compose -f docker-compose.prod.yml exec db mysql -u rebookd -p

# Password: rebookd (or whatever you set in .env.production)

# View test user
SELECT * FROM users WHERE email = 'brendanjj96@outlook.com';

# View tenant
SELECT * FROM tenants WHERE slug = 'default';

# View automations
SELECT * FROM automations WHERE tenantId = 1;
```

## Reset Password (If Needed)

If you need to reset the password, generate a new bcryptjs hash:

```bash
# Using Node.js
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('password1', 10).then(h => console.log(h));"
```

Then update the database:

```sql
UPDATE users 
SET passwordHash = '<new_hash>' 
WHERE email = 'brendanjj96@outlook.com';
```

## Production Notes

**IMPORTANT**: This is a TEST account only!

Before production:
- [ ] Delete or disable this test account
- [ ] Change all default credentials
- [ ] Create actual admin users with strong passwords
- [ ] Enable 2FA if available
- [ ] Set up access controls
- [ ] Create audit logs

## Troubleshooting

### Login fails with "Invalid email or password"

1. Check the user exists:
   ```sql
   SELECT * FROM users WHERE email = 'brendanjj96@outlook.com';
   ```

2. Verify password hash format (should start with `$2a$`)

3. Check user is not disabled:
   ```sql
   SELECT active FROM users WHERE email = 'brendanjj96@outlook.com';
   ```

4. Check tenant assignment:
   ```sql
   SELECT tenantId FROM users WHERE email = 'brendanjj96@outlook.com';
   ```

### Can't access admin panel

1. Verify user role:
   ```sql
   SELECT role FROM users WHERE email = 'brendanjj96@outlook.com';
   ```
   Should be `admin`

2. Try logging out and back in

3. Check browser cookies are not cached

### Password hash doesn't match

The password hash in the script is pre-generated. If you need to verify:

```javascript
// Generate hash for 'password1'
const bcrypt = require('bcryptjs');
const password = 'password1';
const hash = '$2a$10$kEPf2mJGJ.q0XZZ0VZ0PKONvDvZGJZ8Bq8c0VJ8/zJ5I0VZ0PK.Au';

bcrypt.compare(password, hash).then(result => {
  console.log('Match:', result);
});
```

## Next Steps

After testing:

1. Document any issues found
2. Test with more users
3. Test SMS provider integration
4. Test payment flow (if Stripe configured)
5. Load test with multiple concurrent users
6. Prepare for production deployment
