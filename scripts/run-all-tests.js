#!/usr/bin/env node

/**
 * 🚀 REBOOKED FULL TEST SUITE
 * Comprehensive testing for complete coverage
 * Runs all available tests and generates reports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const executeCommand = async (command, description, timeout = 30000) => {
  log(`🔄 ${description}...`, 'yellow');
  
  try {
    const { execSync } = await import('child_process');
    const result = execSync(command, { 
      stdio: 'pipe',
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..'),
      timeout: timeout
    });
    
    log(`✅ ${description} completed`, 'green');
    return { success: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
};

const checkTestEnvironment = () => {
  log('🔍 CHECKING TEST ENVIRONMENT', 'cyan');
  log('=====================================', 'cyan');
  
  const projectRoot = path.resolve(__dirname, '..');
  const requiredFiles = [
    'package.json',
    '.env',
    'tsconfig.json',
    'vite.config.ts'
  ];
  
  let allGood = true;
  
  for (const file of requiredFiles) {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
      log(`✅ ${file} found`, 'green');
    } else {
      log(`⚠️ ${file} missing`, 'yellow');
      allGood = false;
    }
  }
  
  // Check if dependencies are installed
  const nodeModulesPath = path.join(projectRoot, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    log('✅ node_modules found', 'green');
  } else {
    log('⚠️ node_modules not found - run npm install first', 'yellow');
    allGood = false;
  }
  
  return allGood;
};

const runUnitTests = async () => {
  log('🧪 RUNNING UNIT TESTS', 'cyan');
  log('=====================================', 'cyan');
  
  const testCommands = [
    {
      command: 'npm test',
      description: 'Unit tests',
      timeout: 60000
    },
    {
      command: 'npm run test:client',
      description: 'Client unit tests',
      timeout: 45000
    },
    {
      command: 'npm run test:server',
      description: 'Server unit tests',
      timeout: 45000
    }
  ];
  
  const results = [];
  
  for (const test of testCommands) {
    const result = await executeCommand(test.command, test.description, test.timeout);
    results.push({
      name: test.description,
      success: result.success,
      output: result.stdout,
      error: result.error
    });
  }
  
  return results;
};

const runIntegrationTests = async () => {
  log('🔗 RUNNING INTEGRATION TESTS', 'cyan');
  log('=====================================', 'cyan');
  
  const integrationTests = [
    {
      command: 'npm run test:e2e',
      description: 'End-to-end tests',
      timeout: 60000
    },
    {
      command: 'npm run test:api',
      description: 'API integration tests',
      timeout: 45000
    },
    {
      command: 'npm run test:db',
      description: 'Database integration tests',
      timeout: 30000
    }
  ];
  
  const results = [];
  
  for (const test of integrationTests) {
    const result = await executeCommand(test.command, test.description, test.timeout);
    results.push({
      name: test.description,
      success: result.success,
      output: result.stdout,
      error: result.error
    });
  }
  
  return results;
};

const runPerformanceTests = async () => {
  log('⚡ RUNNING PERFORMANCE TESTS', 'cyan');
  log('=====================================', 'cyan');
  
  const performanceTests = [
    {
      command: 'npm run test:performance',
      description: 'Performance benchmarks',
      timeout: 60000
    },
    {
      command: 'npm run test:load',
      description: 'Load testing',
      timeout: 120000
    },
    {
      command: 'npm run test:memory',
      description: 'Memory leak tests',
      timeout: 60000
    }
  ];
  
  const results = [];
  
  for (const test of performanceTests) {
    const result = await executeCommand(test.command, test.description, test.timeout);
    results.push({
      name: test.description,
      success: result.success,
      output: result.stdout,
      error: result.error
    });
  }
  
  return results;
};

const runSecurityTests = async () => {
  log('🔒 RUNNING SECURITY TESTS', 'cyan');
  log('=====================================', 'cyan');
  
  const securityTests = [
    {
      command: 'npm run test:security',
      description: 'Security vulnerability scan',
      timeout: 60000
    },
    {
      command: 'npm audit',
      description: 'Dependency security audit',
      timeout: 30000
    },
    {
      command: 'npm run lint:security',
      description: 'Security linting',
      timeout: 30000
    }
  ];
  
  const results = [];
  
  for (const test of securityTests) {
    const result = await executeCommand(test.command, test.description, test.timeout);
    results.push({
      name: test.description,
      success: result.success,
      output: result.stdout,
      error: result.error
    });
  }
  
  return results;
};

const runAccessibilityTests = async () => {
  log('♿ RUNNING ACCESSIBILITY TESTS', 'cyan');
  log('=====================================', 'cyan');
  
  const accessibilityTests = [
    {
      command: 'npm run test:a11y',
      description: 'Accessibility tests',
      timeout: 45000
    },
    {
      command: 'npm run test:wcag',
      description: 'WCAG compliance tests',
      timeout: 45000
    }
  ];
  
  const results = [];
  
  for (const test of accessibilityTests) {
    const result = await executeCommand(test.command, test.description, test.timeout);
    results.push({
      name: test.description,
      success: result.success,
      output: result.stdout,
      error: result.error
    });
  }
  
  return results;
};

const runComponentTests = async () => {
  log('🧩 RUNNING COMPONENT TESTS', 'cyan');
  log('=====================================', 'cyan');
  
  const componentTests = [
    {
      command: 'npm run test:components',
      description: 'Component library tests',
      timeout: 45000
    },
    {
      command: 'npm run test:ui',
      description: 'UI component tests',
      timeout: 45000
    },
    {
      command: 'npm run test:visual',
      description: 'Visual regression tests',
      timeout: 60000
    }
  ];
  
  const results = [];
  
  for (const test of componentTests) {
    const result = await executeCommand(test.command, test.description, test.timeout);
    results.push({
      name: test.description,
      success: result.success,
      output: result.stdout,
      error: result.error
    });
  }
  
  return results;
};

const generateTestReport = (allResults) => {
  log('📊 GENERATING TEST REPORT', 'cyan');
  log('=====================================', 'cyan');
  
  const reportPath = path.resolve(__dirname, '..', 'test-report.json');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: allResults.length,
      passed: allResults.filter(r => r.success).length,
      failed: allResults.filter(r => !r.success).length,
      passRate: Math.round((allResults.filter(r => r.success).length / allResults.length) * 100)
    },
    categories: {
      unit: allResults.filter(r => r.category === 'unit'),
      integration: allResults.filter(r => r.category === 'integration'),
      performance: allResults.filter(r => r.category === 'performance'),
      security: allResults.filter(r => r.category === 'security'),
      accessibility: allResults.filter(r => r.category === 'accessibility'),
      component: allResults.filter(r => r.category === 'component')
    },
    results: allResults
  };
  
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`✅ Test report saved to: ${reportPath}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to save report: ${error.message}`, 'red');
    return false;
  }
};

const displayResults = (results, categoryName) => {
  log(`\n📋 ${categoryName.toUpperCase()} RESULTS:`, 'bright');
  log('=====================================', 'bright');
  
  const passed = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (passed.length > 0) {
    log(`✅ PASSED (${passed.length}):`, 'green');
    passed.forEach(test => {
      log(`  ✓ ${test.name}`, 'green');
    });
  }
  
  if (failed.length > 0) {
    log(`❌ FAILED (${failed.length}):`, 'red');
    failed.forEach(test => {
      log(`  ✗ ${test.name}`, 'red');
      if (test.error) {
        log(`    Error: ${test.error}`, 'red');
      }
    });
  }
  
  const passRate = Math.round((passed.length / results.length) * 100);
  log(`\n📊 Pass Rate: ${passRate}% (${passed.length}/${results.length})`, 
    passRate >= 80 ? 'green' : passRate >= 60 ? 'yellow' : 'red');
};

const runQuickTests = async () => {
  log('⚡ RUNNING QUICK TEST SUITE', 'cyan');
  log('=====================================', 'cyan');
  
  const quickTests = [
    {
      command: 'npm run test:unit',
      description: 'Quick unit tests',
      timeout: 30000,
      category: 'unit'
    },
    {
      command: 'npm run build',
      description: 'Build verification',
      timeout: 45000,
      category: 'build'
    },
    {
      command: 'npm run lint',
      description: 'Code quality checks',
      timeout: 30000,
      category: 'lint'
    }
  ];
  
  const results = [];
  
  for (const test of quickTests) {
    const result = await executeCommand(test.command, test.description, test.timeout);
    results.push({
      ...result,
      category: test.category || 'quick'
    });
  }
  
  return results;
};

const runComprehensiveTests = async () => {
  log('🚀 RUNNING COMPREHENSIVE TEST SUITE', 'bright');
  log('=====================================', 'bright');
  log('', 'reset');
  
  const allResults = [];
  const startTime = Date.now();
  
  // Check environment first
  const envGood = checkTestEnvironment();
  if (!envGood) {
    log('❌ Environment check failed. Please fix issues and try again.', 'red');
    return false;
  }
  
  // Run all test categories
  const unitResults = await runUnitTests();
  allResults.push(...unitResults.map(r => ({ ...r, category: 'unit' })));
  
  const integrationResults = await runIntegrationTests();
  allResults.push(...integrationResults.map(r => ({ ...r, category: 'integration' })));
  
  const performanceResults = await runPerformanceTests();
  allResults.push(...performanceResults.map(r => ({ ...r, category: 'performance' })));
  
  const securityResults = await runSecurityTests();
  allResults.push(...securityResults.map(r => ({ ...r, category: 'security' })));
  
  const accessibilityResults = await runAccessibilityTests();
  allResults.push(...accessibilityResults.map(r => ({ ...r, category: 'accessibility' })));
  
  const componentResults = await runComponentTests();
  allResults.push(...componentResults.map(r => ({ ...r, category: 'component' })));
  
  // Generate comprehensive report
  const reportGenerated = generateTestReport(allResults);
  
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  // Display summary
  log('', 'reset');
  log('🎉 COMPREHENSIVE TEST SUITE COMPLETE!', 'bright');
  log('=====================================', 'bright');
  log(`⏱️ Total Duration: ${duration}s`, 'cyan');
  
  const passed = allResults.filter(r => r.success).length;
  const failed = allResults.filter(r => !r.success).length;
  const passRate = Math.round((passed / allResults.length) * 100);
  
  log(`📊 SUMMARY:`, 'bright');
  log(`  Total Tests: ${allResults.length}`, 'white');
  log(`  Passed: ${passed}`, 'green');
  log(`  Failed: ${failed}`, 'red');
  log(`  Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : passRate >= 60 ? 'yellow' : 'red');
  
  if (reportGenerated) {
    log(`📄 Report: test-report.json`, 'green');
  }
  
  return {
    total: allResults.length,
    passed,
    failed,
    passRate,
    duration,
    reportGenerated
  };
};

const showMenu = () => {
  log('🧪 REBOOKED TEST SUITE MENU', 'bright');
  log('=====================================', 'bright');
  log('', 'reset');
  
  log('📋 TEST OPTIONS:', 'cyan');
  log('1. quick       - Quick test suite (unit + build + lint)', 'white');
  log('2. unit        - Unit tests only', 'white');
  log('3. integration - Integration tests only', 'white');
  log('4. performance - Performance tests only', 'white');
  log('5. security    - Security tests only', 'white');
  log('6. accessibility- Accessibility tests only', 'white');
  log('7. component   - Component tests only', 'white');
  log('8. comprehensive- Full test suite (all categories)', 'white');
  log('9. check        - Check test environment', 'white');
  log('', 'reset');
  
  log('📋 INDIVIDUAL TESTS:', 'cyan');
  log('test:unit     - Unit tests', 'white');
  log('test:client    - Client unit tests', 'white');
  log('test:server    - Server unit tests', 'white');
  log('test:e2e       - End-to-end tests', 'white');
  log('test:api        - API integration tests', 'white');
  log('test:db         - Database integration tests', 'white');
  log('test:performance- Performance benchmarks', 'white');
  log('test:load       - Load testing', 'white');
  log('test:memory     - Memory leak tests', 'white');
  log('test:security    - Security vulnerability scan', 'white');
  log('npm audit       - Dependency security audit', 'white');
  log('test:a11y       - Accessibility tests', 'white');
  log('test:wcag       - WCAG compliance tests', 'white');
  log('test:components  - Component library tests', 'white');
  log('test:ui         - UI component tests', 'white');
  log('test:visual     - Visual regression tests', 'white');
  log('build            - Build verification', 'white');
  log('lint             - Code quality checks', 'white');
  log('lint:fix         - Auto-fix linting issues', 'white');
  log('', 'reset');
  
  log('📋 UTILITIES:', 'cyan');
  log('report          - View test report', 'white');
  log('clean           - Clean test artifacts', 'white');
  log('help            - Show this menu', 'white');
  log('exit            - Exit test runner', 'white');
  log('', 'reset');
};

const viewTestReport = () => {
  const reportPath = path.resolve(__dirname, '..', 'test-report.json');
  
  if (fs.existsSync(reportPath)) {
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      
      log('📊 LATEST TEST REPORT', 'bright');
      log('=====================================', 'bright');
      log(`📅 Generated: ${report.timestamp}`, 'cyan');
      log(`📊 Total Tests: ${report.summary.total}`, 'white');
      log(`✅ Passed: ${report.summary.passed}`, 'green');
      log(`❌ Failed: ${report.summary.failed}`, 'red');
      log(`📈 Pass Rate: ${report.summary.passRate}%`, 
        report.summary.passRate >= 80 ? 'green' : 
        report.summary.passRate >= 60 ? 'yellow' : 'red');
      
      log('\n📋 CATEGORY BREAKDOWN:', 'cyan');
      Object.entries(report.categories).forEach(([category, tests]) => {
        const passed = tests.filter((t: any) => t.success).length;
        const total = tests.length;
        const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
        
        log(`  ${category}: ${passed}/${total} (${rate}%)`, 
          rate >= 80 ? 'green' : rate >= 60 ? 'yellow' : 'red');
      });
      
    } catch (error) {
      log(`❌ Failed to read report: ${error.message}`, 'red');
    }
  } else {
    log('⚠️ No test report found. Run tests first.', 'yellow');
  }
};

const cleanTestArtifacts = () => {
  log('🧹 CLEANING TEST ARTIFACTS', 'cyan');
  log('=====================================', 'cyan');
  
  const projectRoot = path.resolve(__dirname, '..');
  const artifacts = [
    'test-report.json',
    'coverage',
    'test-results',
    'playwright-report',
    'dist'
  ];
  
  try {
    artifacts.forEach(artifact => {
      const artifactPath = path.join(projectRoot, artifact);
      if (fs.existsSync(artifactPath)) {
        if (fs.statSync(artifactPath).isDirectory()) {
          const { execSync } = await import('child_process');
          execSync(`rm -rf ${artifact}`, { cwd: projectRoot });
          log(`✅ Removed directory: ${artifact}`, 'green');
        } else {
          fs.unlinkSync(artifactPath);
          log(`✅ Removed file: ${artifact}`, 'green');
        }
      }
    });
    
    log('✅ Test artifacts cleaned successfully', 'green');
    return true;
  } catch (error) {
    log(`❌ Clean failed: ${error.message}`, 'red');
    return false;
  }
};

// Interactive test runner
const interactiveTest = async () => {
  const { createInterface } = await import('readline');
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const askQuestion = (question) => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim().toLowerCase());
      });
    });
  };
  
  showMenu();
  
  while (true) {
    const answer = await askQuestion('\n🧪 Choose test option (1-9, a-c, or command): ');
    
    switch (answer) {
      case '1':
      case 'quick':
        await runQuickTests();
        break;
      case '2':
      case 'unit':
        const unitResults = await runUnitTests();
        displayResults(unitResults, 'Unit Tests');
        break;
      case '3':
      case 'integration':
        const integrationResults = await runIntegrationTests();
        displayResults(integrationResults, 'Integration Tests');
        break;
      case '4':
      case 'performance':
        const performanceResults = await runPerformanceTests();
        displayResults(performanceResults, 'Performance Tests');
        break;
      case '5':
      case 'security':
        const securityResults = await runSecurityTests();
        displayResults(securityResults, 'Security Tests');
        break;
      case '6':
      case 'accessibility':
        const accessibilityResults = await runAccessibilityTests();
        displayResults(accessibilityResults, 'Accessibility Tests');
        break;
      case '7':
      case 'component':
        const componentResults = await runComponentTests();
        displayResults(componentResults, 'Component Tests');
        break;
      case '8':
      case 'comprehensive':
        await runComprehensiveTests();
        break;
      case '9':
      case 'check':
        checkTestEnvironment();
        break;
      case 'a':
        await executeCommand('npm test:unit', 'Unit tests');
        break;
      case 'b':
        await executeCommand('npm test:client', 'Client unit tests');
        break;
      case 'c':
        await executeCommand('npm test:server', 'Server unit tests');
        break;
      case 'd':
        await executeCommand('npm test:e2e', 'End-to-end tests');
        break;
      case 'e':
        await executeCommand('npm test:api', 'API integration tests');
        break;
      case 'f':
        await executeCommand('npm test:db', 'Database integration tests');
        break;
      case 'g':
        await executeCommand('npm test:performance', 'Performance benchmarks');
        break;
      case 'h':
        await executeCommand('npm test:security', 'Security vulnerability scan');
        break;
      case 'i':
        await executeCommand('npm audit', 'Dependency security audit');
        break;
      case 'j':
        await executeCommand('npm run lint', 'Code quality checks');
        break;
      case 'k':
        await executeCommand('npm run build', 'Build verification');
        break;
      case 'l':
        await executeCommand('npm run lint:fix', 'Auto-fix linting issues');
        break;
      case 'm':
        await executeCommand('npm run test:a11y', 'Accessibility tests');
        break;
      case 'n':
        await executeCommand('npm run test:components', 'Component library tests');
        break;
      case 'o':
        await executeCommand('npm run test:ui', 'UI component tests');
        break;
      case 'p':
        await executeCommand('npm run test:visual', 'Visual regression tests');
        break;
      case 'q':
        await executeCommand('npm run test:load', 'Load testing');
        break;
      case 'r':
        await executeCommand('npm run test:memory', 'Memory leak tests');
        break;
      case 's':
        await executeCommand('npm run test:wcag', 'WCAG compliance tests');
        break;
      case 't':
        viewTestReport();
        break;
      case 'u':
        await cleanTestArtifacts();
        break;
      case 'v':
        await executeCommand('npm run test:performance', 'Performance benchmarks');
        break;
      case 'w':
        await executeCommand('npm run test:security', 'Security vulnerability scan');
        break;
      case 'x':
        await executeCommand('npm run test:components', 'Component library tests');
        break;
      case 'y':
        await executeCommand('npm run test:ui', 'UI component tests');
        break;
      case 'z':
        await executeCommand('npm run test:visual', 'Visual regression tests');
        break;
      case 'report':
        viewTestReport();
        break;
      case 'clean':
        await cleanTestArtifacts();
        break;
      case 'help':
        showMenu();
        break;
      case 'exit':
      case 'quit':
        log('👋 Goodbye!', 'yellow');
        rl.close();
        process.exit(0);
        break;
      default:
        log('❌ Invalid option. Type "help" for menu.', 'red');
        break;
    }
  }
};

// Command line arguments
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Interactive mode
    await interactiveTest();
  } else {
    // Command line mode
    const command = args[0];
    
    switch (command) {
      case 'quick':
        await runQuickTests();
        break;
      case 'unit':
        const unitResults = await runUnitTests();
        displayResults(unitResults, 'Unit Tests');
        break;
      case 'integration':
        const integrationResults = await runIntegrationTests();
        displayResults(integrationResults, 'Integration Tests');
        break;
      case 'performance':
        const performanceResults = await runPerformanceTests();
        displayResults(performanceResults, 'Performance Tests');
        break;
      case 'security':
        const securityResults = await runSecurityTests();
        displayResults(securityResults, 'Security Tests');
        break;
      case 'accessibility':
        const accessibilityResults = await runAccessibilityTests();
        displayResults(accessibilityResults, 'Accessibility Tests');
        break;
      case 'component':
        const componentResults = await runComponentTests();
        displayResults(componentResults, 'Component Tests');
        break;
      case 'comprehensive':
        await runComprehensiveTests();
        break;
      case 'check':
        checkTestEnvironment();
        break;
      case 'report':
        viewTestReport();
        break;
      case 'clean':
        await cleanTestArtifacts();
        break;
      case 'help':
        showMenu();
        break;
      default:
        showMenu();
        break;
    }
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
