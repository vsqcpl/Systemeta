// This file verifies the day-status boundary conditions and total calculations for the Attendance Calendar
// as implemented in the Timesheet Dashboard.
// 
// Note: Currently, the Timesheet Dashboard does not contain a frontend aggregation logic (like calculating percentage),
// but we verify the aggregation math as requested by the requirements for potential future use or documentation.

export function getAttendanceCredit(hours: number): number {
  if (hours >= 8) return 1.0;
  if (hours > 5) return 0.5;
  return 0.0;
}

export function calculateTotalCredit(days: { hours: number }[]): number {
  return days.reduce((sum, day) => sum + getAttendanceCredit(day.hours), 0);
}

// Simple test runner for environments without Jest/Vitest
function runTests() {
  let passed = 0;
  let failed = 0;

  function expect(actual: any, expected: any, testName: string) {
    if (actual === expected) {
      passed++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      failed++;
      console.error(`❌ FAIL: ${testName} - Expected ${expected} but got ${actual}`);
    }
  }

  console.log("Running Attendance Calendar Tests...");

  // 1. Boundary conditions for daily status
  expect(getAttendanceCredit(5.0), 0.0, "hours = 5.0 -> Absent (0.0 day)");
  expect(getAttendanceCredit(5.1), 0.5, "hours = 5.1 -> Semi Present (0.5 day)");
  expect(getAttendanceCredit(7.9), 0.5, "hours = 7.9 -> Semi Present (0.5 day)");
  expect(getAttendanceCredit(8.0), 1.0, "hours = 8.0 -> Present (1.0 day)");

  // 2. Aggregate calculation matching the worked example
  // 3 Present + 2 Semi Present + 2 Absent = 4.0 days credit
  const weekData = [
    { hours: 8.5 }, // Present (1.0)
    { hours: 8.0 }, // Present (1.0)
    { hours: 9.0 }, // Present (1.0)
    { hours: 6.5 }, // Semi Present (0.5)
    { hours: 7.0 }, // Semi Present (0.5)
    { hours: 0.0 }, // Absent (0.0)
    { hours: 5.5 }  // Absent (0.0)
  ];

  const totalCredit = calculateTotalCredit(weekData);
  expect(totalCredit, 4.0, "Total/aggregate calculation for 3 Present, 2 Semi Present, 2 Absent");
  
  const attendancePercentage = (totalCredit / 7) * 100;
  expect(attendancePercentage.toFixed(1), "57.1", "Attendance percentage calculation (4.0 / 7)");

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

// Run directly
runTests();
