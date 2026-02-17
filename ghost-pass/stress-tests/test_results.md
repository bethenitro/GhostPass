
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

WALLET TEST


  █ THRESHOLDS

    funding_success_rate
    ✓ 'rate>0.995' rate=99.94%

    http_req_duration
    ✓ 'p(95)<5000' p(95)=1.08s

    http_req_failed
    ✓ 'rate<0.005' rate=0.00%


  █ TOTAL RESULTS

    checks_total.......: 17580  19.415098/s
    checks_succeeded...: 99.98% 17578 out of 17580
    checks_failed......: 0.01%  2 out of 17580

    ✓ status is 200
    ✓ response has status field
    ✓ funding successful
    ✓ balance updated
    ✗ response time < 5s
      ↳  99% — ✓ 3514 / ✗ 2

    CUSTOM
    funding_duration...............: avg=966.079067 min=619      med=964      max=8589   p(90)=1057.5 p(95)=1104
    funding_success_rate...........: 99.94% 3514 out of 3516

    HTTP
    http_req_duration..............: avg=953.87ms   min=619.03ms med=961.55ms max=8.58s  p(90)=1.05s  p(95)=1.08s
      { expected_response:true }...: avg=953.87ms   min=619.03ms med=961.55ms max=8.58s  p(90)=1.05s  p(95)=1.08s
    http_req_failed................: 0.00%  0 out of 3516
    http_reqs......................: 3516   3.88302/s

    EXECUTION
    iteration_duration.............: avg=10.94s     min=5.66s    med=10.89s   max=17.66s p(90)=14.95s p(95)=15.45s
    iterations.....................: 3516   3.88302/s
    vus............................: 1      min=1            max=50
    vus_max........................: 50     min=50           max=50

    NETWORK
    data_received..................: 1.5 MB 1.6 kB/s
    data_sent......................: 536 kB 592 B/s




running (15m05.5s), 00/50 VUs, 3516 complete and 0 interrupted iterations
default ✓ [======================================] 00/50 VUs  15m0s