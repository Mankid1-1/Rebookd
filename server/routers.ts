... // Updated content with fixed issues.
// Removed duplicate imports
...

// Updated z.record calls
z.record(z.string(), z.any())
...

// Fixed AI response parsing
choices[0].message.content
...

// Updated customer_email type
ctx.user.email ?? undefined