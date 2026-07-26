process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
import "dotenv/config";

import express from "express";
import http from "http";
import prisma from "./src/lib/prisma.js";
import app from "./src/app.js";

async function runTests() {
  console.log("\n==================================================");
  console.log("   RUNNING REMEMBER ME SYSTEM INTEGRATION TESTS   ");
  console.log("==================================================\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5009, () => resolve()));
  const baseUrl = "http://localhost:5009";

  let testPassedCount = 0;
  let testTotalCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    testTotalCount++;
    if (condition) {
      testPassedCount++;
      console.log(`✅ [PASS] Test ${testTotalCount}: ${testName}`);
    } else {
      console.error(`❌ [FAIL] Test ${testTotalCount}: ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
    }
  }

  try {
    // Seed test user if not existing
    const testEmail = "remember_me_test_user@systemeta.com";
    await prisma.session.deleteMany({
      where: { user: { email: testEmail } }
    });
    await prisma.user.deleteMany({
      where: { email: testEmail }
    });

    const bcrypt = (await import("bcrypt")).default;
    const hashedPassword = await bcrypt.hash("TestPass123!", 10);

    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Remember Me Test User",
        passwordHash: hashedPassword,
        role: "consultant",
        status: "active",
        mustChangePassword: false,
      }
    });

    await prisma.account.create({
      data: {
        id: "acc_" + testUser.id,
        userId: testUser.id,
        accountId: testUser.id,
        providerId: "credential",
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // ----------------------------------------------------
    // TEST 1: Login with Remember Me = TRUE (Requirement 1 & 3 & 10)
    // ----------------------------------------------------
    const loginTrueRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000"
      },
      body: JSON.stringify({
        email: testEmail,
        password: "TestPass123!",
        rememberMe: true,
      })
    });

    const loginTrueJson = await loginTrueRes.json();
    const setCookieHeadersTrue = loginTrueRes.headers.getSetCookie();
    const cookieStrTrue = setCookieHeadersTrue.join("; ");

    assert(
      loginTrueRes.status === 200,
      "Login with Remember Me = true succeeds",
      `Status: ${loginTrueRes.status}, Body: ${JSON.stringify(loginTrueJson)}`
    );
    assert(
      cookieStrTrue.includes("Max-Age=2592000"),
      "Set-Cookie header contains Max-Age=2592000 (30 days)",
      `Got cookie header: ${cookieStrTrue}`
    );
    assert(
      cookieStrTrue.toLowerCase().includes("httponly"),
      "Set-Cookie header contains HttpOnly flag"
    );
    assert(
      !loginTrueJson.token && (!loginTrueJson.session || !loginTrueJson.session.token),
      "JSON response does NOT expose raw session token to frontend JS (Req 10)",
      JSON.stringify(loginTrueJson)
    );

    // Verify Database Session Expiry for Remember Me = TRUE
    const sessionsTrue = await prisma.session.findMany({
      where: { userId: testUser.id }
    });
    assert(sessionsTrue.length === 1, "Session recorded in database");
    const sessionTrue = sessionsTrue[0];
    const diffDaysTrue = (new Date(sessionTrue.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    assert(
      diffDaysTrue >= 29 && diffDaysTrue <= 31,
      "Database session expiresAt is set to ~30 days in future (Req 1)",
      `Actual days remaining: ${diffDaysTrue.toFixed(2)}`
    );

    // ----------------------------------------------------
    // TEST 2: Browser Restart Simulation / Rehydration (Requirement 4)
    // ----------------------------------------------------
    const sessionCookieHeader = setCookieHeadersTrue[0];
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      method: "GET",
      headers: { Cookie: sessionCookieHeader }
    });
    const meJson = await meRes.json();

    assert(meRes.status === 200, "Session rehydrates successfully after browser restart (Req 4)");
    assert(meJson.email === testEmail, "Me endpoint returns authenticated user profile");

    // ----------------------------------------------------
    // TEST 3: Multi-Device Independent Sessions (Requirement 7 & 8)
    // ----------------------------------------------------
    const loginFalseRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "User-Agent": "Device-B-Browser"
      },
      body: JSON.stringify({
        email: testEmail,
        password: "TestPass123!",
        rememberMe: false,
      })
    });

    const setCookieHeadersFalse = loginFalseRes.headers.getSetCookie();
    const cookieStrFalse = setCookieHeadersFalse.join("; ");

    assert(
      loginFalseRes.status === 200,
      "Login from Device B (Remember Me = false) succeeds",
      `Status: ${loginFalseRes.status}, Body: ${await loginFalseRes.text()}`
    );
    assert(
      !cookieStrFalse.toLowerCase().includes("max-age="),
      "Set-Cookie for Remember Me = false does NOT contain Max-Age (Session Cookie) (Req 2)",
      `Got cookie header: ${cookieStrFalse}`
    );
    assert(
      !cookieStrFalse.toLowerCase().includes("expires="),
      "Set-Cookie for Remember Me = false does NOT contain Expires (Session Cookie) (Req 2)"
    );

    const sessionsMulti = await prisma.session.findMany({
      where: { userId: testUser.id }
    });
    assert(sessionsMulti.length === 2, "Multiple devices have independent sessions stored (Req 7)");
    const nonExtendedSession = sessionsMulti.find(s => s.id !== sessionTrue.id);
    const diffDaysFalse = (new Date(nonExtendedSession!.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    assert(
      diffDaysFalse >= 0.9 && diffDaysFalse <= 1.1,
      "Non-remember session in database expiresAt is set to ~24 hours (1 day)",
      `Actual days remaining: ${diffDaysFalse.toFixed(2)}`
    );

    // ----------------------------------------------------
    // TEST 4: Expired Token Auto-Invalidation (Requirement 5)
    // ----------------------------------------------------
    // Create expired session
    const expiredSessionId = "expired_sess_" + Date.now();
    await prisma.session.create({
      data: {
        id: expiredSessionId,
        token: "expired_token_" + Date.now(),
        userId: testUser.id,
        expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        updatedAt: new Date(),
      }
    });

    const expiredCheckRes = await fetch(`${baseUrl}/api/auth/me`, {
      method: "GET",
      headers: { Cookie: `better-auth.session_token=expired_token_${Date.now()}` }
    });
    assert(expiredCheckRes.status === 401, "Expired session token is rejected with 401 (Req 5)");

    const expiredInDb = await prisma.session.findUnique({ where: { id: expiredSessionId } });
    assert(expiredInDb === null, "Expired remember token is automatically invalidated and purged from DB (Req 5)");

    // ----------------------------------------------------
    // TEST 5: Logout Immediately Invalidates All Tokens (Requirement 6)
    // ----------------------------------------------------
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: sessionCookieHeader,
        Origin: "http://localhost:3000"
      }
    });
    assert(logoutRes.status === 200, "Logout endpoint succeeds");

    const remainingSessionsAfterLogout = await prisma.session.findMany({
      where: { userId: testUser.id }
    });
    assert(
      remainingSessionsAfterLogout.length === 0,
      "Logout immediately invalidates ALL remember tokens for user in DB (Req 6)",
      `Remaining session count: ${remainingSessionsAfterLogout.length}`
    );

    const postLogoutMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      method: "GET",
      headers: { Cookie: sessionCookieHeader }
    });
    assert(postLogoutMeRes.status === 401, "Subsequent requests with old remember token return 401 (Req 6)");

    // Cleanup test user
    await prisma.account.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

  } catch (err) {
    console.error("Test execution failed with error:", err);
  } finally {
    server.close();
  }

  console.log("\n==================================================");
  console.log(`  SUMMARY: ${testPassedCount} / ${testTotalCount} TESTS PASSED`);
  console.log("==================================================\n");

  if (testPassedCount === testTotalCount && testTotalCount > 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
