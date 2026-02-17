
🌱 Seeding Test Data for Stress Testing
═══════════════════════════════════════════════

📍 Creating test venue...
  ✅ Venue created: Stress Test Venue
🚪 Creating test gateways...
  ✅ Gateway already exists: Main Entrance - Door 1 (d7e9908c-aba2-4a64-965a-df9a237e2bcc)
  ✅ Gateway already exists: Main Entrance - Door 2 (1927d103-8add-45bd-9c79-f966b86f418a)

  📝 Gateway IDs for your .env.test file:
  TEST_GATEWAY_1_ID=d7e9908c-aba2-4a64-965a-df9a237e2bcc
  TEST_GATEWAY_2_ID=1927d103-8add-45bd-9c79-f966b86f418a
💰 Creating 5000 test wallets...
   This may take a few minutes...
  ⏳ Created 1000/5000 wallets...
  ⏳ Created 2000/5000 wallets...
  ⏳ Created 3000/5000 wallets...
^C
[nikant@arch stress-tests]$ npm run seed-test-data

> ghostpass-stress-tests@1.0.0 seed-test-data
> node scripts/seed-test-data.js

🌱 Seeding Test Data for Stress Testing
═══════════════════════════════════════════════

📍 Creating test venue...
  ✅ Venue created: Stress Test Venue
🚪 Creating test gateways...
  ✅ Gateway already exists: Main Entrance - Door 1 (d7e9908c-aba2-4a64-965a-df9a237e2bcc)
  ✅ Gateway already exists: Main Entrance - Door 2 (1927d103-8add-45bd-9c79-f966b86f418a)

  📝 Gateway IDs for your .env.test file:
  TEST_GATEWAY_1_ID=d7e9908c-aba2-4a64-965a-df9a237e2bcc
  TEST_GATEWAY_2_ID=1927d103-8add-45bd-9c79-f966b86f418a
💰 Creating 5000 test wallets...
   This may take a few minutes...
  ⏳ Created 1000/5000 wallets...
  ⏳ Created 2000/5000 wallets...
  ⏳ Created 3000/5000 wallets...
  ⏳ Created 4000/5000 wallets...
  ⏳ Created 5000/5000 wallets...
  ✅ Created 5000 wallets (0 errors)
🍔 Creating test vendor items...
  ✅ Item updated: Beer - $8.00
  ✅ Item updated: Cocktail - $12.00
  ✅ Item updated: Soda - $4.00
  ✅ Item updated: Hot Dog - $6.00
  ✅ Item updated: Nachos - $9.00
  ✅ Item updated: Burger - $11.00

═══════════════════════════════════════════════
✅ Test Data Seeding Complete
═══════════════════════════════════════════════




WALLET
  █ THRESHOLDS

    funding_success_rate
    ✓ 'rate>0.995' rate=99.54%

    http_req_duration
    ✓ 'p(95)<5000' p(95)=1.2s

    http_req_failed
    ✓ 'rate<0.005' rate=0.00%


  █ TOTAL RESULTS

    checks_total.......: 17500  19.275399/s
    checks_succeeded...: 99.90% 17484 out of 17500
    checks_failed......: 0.09%  16 out of 17500

    ✓ status is 200
    ✓ response has status field
    ✓ funding successful
    ✓ balance updated
    ✗ response time < 5s
      ↳  99% — ✓ 3484 / ✗ 16

    CUSTOM
    funding_duration...............: avg=1010.318857 min=606      med=958      max=8304   p(90)=1085   p(95)=1327.2
    funding_success_rate...........: 99.54% 3484 out of 3500

    HTTP
    http_req_duration..............: avg=995.48ms    min=606.48ms med=956.16ms max=8.3s   p(90)=1.06s  p(95)=1.2s
      { expected_response:true }...: avg=995.48ms    min=606.48ms med=956.16ms max=8.3s   p(90)=1.06s  p(95)=1.2s
    http_req_failed................: 0.00%  0 out of 3500
    http_reqs......................: 3500   3.85508/s

    EXECUTION
    iteration_duration.............: avg=11s         min=5.76s    med=11.03s   max=20.89s p(90)=15.05s p(95)=15.54s
    iterations.....................: 3500   3.85508/s
    vus............................: 1      min=1            max=50
    vus_max........................: 50     min=50           max=50

    NETWORK
    data_received..................: 1.5 MB 1.6 kB/s
    data_sent......................: 538 kB 592 B/s


  
