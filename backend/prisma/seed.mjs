// ─────────────────────────────────────────────────────────────────
// Database Seeding Script — InvoiceFlow (ES Module)
// Creates default organization and seed admin/client accounts
// ─────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

async function main() {
  console.log('🌱 Starting database seeding for InvoiceFlow...\n');

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || 'Admin User';

  const clientEmail = process.env.SEED_CLIENT_EMAIL?.trim().toLowerCase();
  const clientName = process.env.SEED_CLIENT_NAME?.trim() || 'Client User';

  const orgName = process.env.SEED_ORGANIZATION_NAME?.trim() || 'Demo Enterprise';
  const orgSlug = slugify(orgName);

  // 1. Create or find Organization
  let organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: orgName,
        slug: orgSlug,
      },
    });
    console.log(`✅ Created Organization: ${organization.name} (${organization.slug})`);
  } else {
    console.log(`ℹ️ Organization already exists: ${organization.name} (${organization.slug})`);
  }

  // 2. Create or update Seed Admin (if configured)
  if (adminEmail) {
    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: adminName,
        role: 'ADMIN',
        organizationId: organization.id,
        emailVerifiedAt: new Date(),
      },
      create: {
        email: adminEmail,
        name: adminName,
        role: 'ADMIN',
        organizationId: organization.id,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✅ Seed Admin: ${adminUser.email} (Role: ${adminUser.role})`);
  } else {
    console.log('⚠️ SEED_ADMIN_EMAIL not set in .env.local — skipping admin user seed.');
  }

  // 3. Create or update Seed Client (if configured)
  if (clientEmail) {
    const clientUser = await prisma.user.upsert({
      where: { email: clientEmail },
      update: {
        name: clientName,
        role: 'CLIENT',
        organizationId: organization.id,
        emailVerifiedAt: new Date(),
      },
      create: {
        email: clientEmail,
        name: clientName,
        role: 'CLIENT',
        organizationId: organization.id,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✅ Seed Client: ${clientUser.email} (Role: ${clientUser.role})`);
  } else {
    console.log('⚠️ SEED_CLIENT_EMAIL not set in .env.local — skipping client user seed.');
  }

  console.log('\n✨ Database seeding completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
