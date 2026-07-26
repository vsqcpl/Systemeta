process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
import "dotenv/config";
import prisma from "./src/lib/prisma.js";

async function runClientCrudTests() {
  console.log("==========================================");
  console.log("   RUNNING CRM CLIENT CRUD INTEGRATION TESTS  ");
  console.log("==========================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      console.log(`✅ TEST ${total}: ${description}`);
      passed++;
    } else {
      console.error(`❌ TEST ${total} FAILED: ${description}`);
      process.exitCode = 1;
    }
  }

  try {
    // 1. Create a test client with full field set
    console.log("\n--- 1. Testing Client Creation with Extended Fields ---");
    const createdClient = await prisma.client.create({
      data: {
        name: "Acme Global Solutions",
        company: "Acme Holdings LLC",
        contactPerson: "Sarah Connor",
        email: "sarah@acmeglobal.com",
        phone: "+1 800 555 0199",
        gst: "27AAACA1234A1Z9",
        notes: "Key enterprise client with active multi-year contract",
        industry: "Information Technology",
        website: "https://acmeglobal.com",
        address: "100 Innovation Way, San Jose, CA",
        status: "active",
        tier: "enterprise",
        assignedManagerIds: "Alice Johnson",
        createdBy: "test-admin-id",
      },
    });

    assert(!!createdClient.id, "Client created with valid UUID");
    assert(createdClient.company === "Acme Holdings LLC", "Company name persisted correctly");
    assert(createdClient.contactPerson === "Sarah Connor", "Contact person persisted correctly");
    assert(createdClient.email === "sarah@acmeglobal.com", "Email persisted correctly");
    assert(createdClient.phone === "+1 800 555 0199", "Phone persisted correctly");
    assert(createdClient.gst === "27AAACA1234A1Z9", "GST tax ID persisted correctly");
    assert(createdClient.deletedAt === null, "New client has deletedAt = null");

    // 2. Update Client (Edit functionality)
    console.log("\n--- 2. Testing Client Edit / Update ---");
    const updatedClient = await prisma.client.update({
      where: { id: createdClient.id },
      data: {
        name: "Acme International Systems",
        company: "Acme Group Inc",
        contactPerson: "John Connor",
        email: "john.connor@acmegroup.com",
        phone: "+1 800 555 9900",
        gst: "27AAACA9999Z1Z0",
        notes: "Updated contract terms for FY2026",
        status: "prospect",
        tier: "premium",
      },
    });

    assert(updatedClient.name === "Acme International Systems", "Updated client name saved");
    assert(updatedClient.company === "Acme Group Inc", "Updated company name saved");
    assert(updatedClient.contactPerson === "John Connor", "Updated contact person saved");
    assert(updatedClient.email === "john.connor@acmegroup.com", "Updated email saved");
    assert(updatedClient.phone === "+1 800 555 9900", "Updated phone saved");
    assert(updatedClient.gst === "27AAACA9999Z1Z0", "Updated GST tax ID saved");
    assert(updatedClient.status === "prospect", "Updated status saved");

    // 3. Query Active Clients List (Excludes Soft Deleted)
    console.log("\n--- 3. Testing Active Clients Fetch Query ---");
    const activeClients = await prisma.client.findMany({
      where: { deletedAt: null },
    });
    const found = activeClients.some((c) => c.id === createdClient.id);
    assert(found === true, "Created client appears in active client query");

    // 4. Test Soft Delete
    console.log("\n--- 4. Testing Soft Delete Functionality ---");
    const softDeleted = await prisma.client.update({
      where: { id: createdClient.id },
      data: {
        deletedAt: new Date(),
        status: "Archived",
      },
    });

    assert(softDeleted.deletedAt !== null, "deletedAt timestamp populated on soft delete");
    assert(softDeleted.status === "Archived", "status set to Archived on soft delete");

    // 5. Verify Soft-Deleted Client Excluded from GET List
    console.log("\n--- 5. Testing Soft Delete Exclusion from Active List ---");
    const activeClientsAfterDelete = await prisma.client.findMany({
      where: { deletedAt: null },
    });
    const foundAfterDelete = activeClientsAfterDelete.some((c) => c.id === createdClient.id);
    assert(foundAfterDelete === false, "Soft-deleted client excluded from active client list");

    // 6. Verify Record Remains in Database for Historical Foreign Keys
    console.log("\n--- 6. Testing Historical Record Preservation ---");
    const rawDbRecord = await prisma.client.findUnique({
      where: { id: createdClient.id },
    });
    assert(!!rawDbRecord, "Client record physically exists in DB to preserve historical relationships");
    assert(rawDbRecord?.deletedAt !== null, "Raw DB record maintains soft delete timestamp");

    // Cleanup test record
    await prisma.client.delete({ where: { id: createdClient.id } });

    console.log("\n==========================================");
    console.log(`   TEST RESULTS: ${passed}/${total} PASSED   `);
    console.log("==========================================");

    if (passed === total) {
      console.log("🎉 ALL CRM CLIENT CRUD TESTS PASSED SUCCESSFULLY!");
    }
  } catch (err) {
    console.error("Test failure exception:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runClientCrudTests();
