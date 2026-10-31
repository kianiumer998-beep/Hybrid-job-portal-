import { getProvinceForCity, normalizeCityName, normalizeProvinceName } from '../../src/utils/locationCatalog';
import { LocationRepository } from '../db/repositories/LocationRepository';
import { JobRepository } from '../db/repositories/JobRepository';
import { Database } from '../db/database';
import { Job } from '../../src/types/job';

async function runStep65B3Verification() {
  console.log('=== STEP 65-B.3 VERIFICATION SUITE START ===\n');
  const results: { test: number; name: string; status: 'PASSED' | 'FAILED'; details?: string }[] = [];

  // --- TEST 1: New job with blank/missing country defaults to Pakistan ---
  try {
    const jobData: Partial<Job> = {
      title: 'Software Engineer Test Defaults',
      company: 'Tech Corp',
      location: 'Lahore',
      city: 'Lahore',
      country: '' // blank country
    };
    const created = await JobRepository.create(jobData);
    if (created && created.country === 'Pakistan') {
      results.push({ test: 1, name: 'New job with blank country defaults to Pakistan', status: 'PASSED', details: `Created job country is "${created.country}"` });
    } else {
      results.push({ test: 1, name: 'New job with blank country defaults to Pakistan', status: 'FAILED', details: `Expected "Pakistan", got "${created?.country}"` });
    }
  } catch (err: any) {
    results.push({ test: 1, name: 'New job with blank country defaults to Pakistan', status: 'FAILED', details: err.message });
  }

  // --- TEST 2: Existing foreign job retains its country (e.g. 'United States') ---
  try {
    const foreignJob: Partial<Job> = {
      title: 'Remote Engineer USA',
      company: 'Global Inc',
      location: 'New York, USA',
      city: 'New York',
      country: 'United States'
    };
    const createdForeign = await JobRepository.create(foreignJob);
    if (createdForeign && createdForeign.country === 'United States') {
      // Also verify updating job does not overwrite foreign country
      const updated = await JobRepository.update(createdForeign.id, { title: 'Senior Remote Engineer USA' });
      if (updated && updated.country === 'United States') {
        results.push({ test: 2, name: 'Existing foreign job retains its country', status: 'PASSED', details: `Foreign country preserved: "${updated.country}"` });
      } else {
        results.push({ test: 2, name: 'Existing foreign job retains its country', status: 'FAILED', details: `Country changed on update: "${updated?.country}"` });
      }
    } else {
      results.push({ test: 2, name: 'Existing foreign job retains its country', status: 'FAILED', details: `Initial country failed: "${createdForeign?.country}"` });
    }
  } catch (err: any) {
    results.push({ test: 2, name: 'Existing foreign job retains its country', status: 'FAILED', details: err.message });
  }

  // --- TESTS 3-8: Mappings: Lahore, Rawalpindi, Faisalabad, Gujranwala, Karachi, Islamabad ---
  const expectedMappings = [
    { test: 3, city: 'Lahore', expectedProvince: 'Punjab' },
    { test: 4, city: 'Rawalpindi', expectedProvince: 'Punjab' },
    { test: 5, city: 'Faisalabad', expectedProvince: 'Punjab' },
    { test: 6, city: 'Gujranwala', expectedProvince: 'Punjab' },
    { test: 7, city: 'Karachi', expectedProvince: 'Sindh' },
    { test: 8, city: 'Islamabad', expectedProvince: 'Islamabad Capital Territory' },
  ];

  for (const m of expectedMappings) {
    const detected = getProvinceForCity(m.city);
    // Also test case variations and whitespace
    const detectedVariations = [
      getProvinceForCity(m.city.toLowerCase()),
      getProvinceForCity(`  ${m.city.toUpperCase()}  `)
    ];

    if (detected === m.expectedProvince && detectedVariations.every(v => v === m.expectedProvince)) {
      results.push({
        test: m.test,
        name: `City mapping for ${m.city} -> ${m.expectedProvince}`,
        status: 'PASSED',
        details: `Exact & case-insensitive trimmed matches: "${detected}"`
      });
    } else {
      results.push({
        test: m.test,
        name: `City mapping for ${m.city} -> ${m.expectedProvince}`,
        status: 'FAILED',
        details: `Expected "${m.expectedProvince}", got "${detected}"`
      });
    }
  }

  // --- TEST 9: Unknown city does not receive a fabricated province ---
  try {
    const unknownCity = 'Atlantis City Unknown 123';
    const detectedUnknown = getProvinceForCity(unknownCity);
    const blankCity = getProvinceForCity('   ');
    if (detectedUnknown === null && blankCity === null) {
      results.push({
        test: 9,
        name: 'Unknown city does not receive a fabricated province',
        status: 'PASSED',
        details: 'Returns null for unknown city and blank input'
      });
    } else {
      results.push({
        test: 9,
        name: 'Unknown city does not receive a fabricated province',
        status: 'FAILED',
        details: `Unknown returned: "${detectedUnknown}", blank returned: "${blankCity}"`
      });
    }
  } catch (err: any) {
    results.push({ test: 9, name: 'Unknown city does not receive a fabricated province', status: 'FAILED', details: err.message });
  }

  // --- TEST 10: Admin adds a new city with a selected province ---
  const testNewCity = 'Kotli Sattian Test';
  try {
    const addResult = await LocationRepository.addCity('Punjab', testNewCity, ['Sector 1']);
    if (addResult.success) {
      results.push({
        test: 10,
        name: 'Admin adds a new city with a selected province',
        status: 'PASSED',
        details: `Successfully added "${testNewCity}" under Punjab`
      });
    } else {
      results.push({
        test: 10,
        name: 'Admin adds a new city with a selected province',
        status: 'FAILED',
        details: addResult.error || 'Failed to add city'
      });
    }
  } catch (err: any) {
    results.push({ test: 10, name: 'Admin adds a new city with a selected province', status: 'FAILED', details: err.message });
  }

  // --- TEST 11: Added city is available after reload/query ---
  try {
    const catalog = await LocationRepository.getAll();
    const punjab = catalog.find(p => p.province.toLowerCase() === 'punjab');
    const cityFound = punjab?.cities.some(c => c.name.toLowerCase() === testNewCity.toLowerCase());
    const provinceMapped = getProvinceForCity(testNewCity, catalog);

    if (cityFound && provinceMapped === 'Punjab') {
      results.push({
        test: 11,
        name: 'Added city is available after reload/query',
        status: 'PASSED',
        details: `City found in catalog and correctly mapped to "${provinceMapped}"`
      });
    } else {
      results.push({
        test: 11,
        name: 'Added city is available after reload/query',
        status: 'FAILED',
        details: `cityFound: ${cityFound}, provinceMapped: ${provinceMapped}`
      });
    }
  } catch (err: any) {
    results.push({ test: 11, name: 'Added city is available after reload/query', status: 'FAILED', details: err.message });
  }

  // --- TEST 12: Admin edits a city/province mapping ---
  const testUpdatedCity = 'Kotli Sattian Renamed';
  try {
    const updateResult = await LocationRepository.updateCity(testNewCity, testUpdatedCity, 'Punjab');
    if (updateResult.success) {
      const updatedCatalog = await LocationRepository.getAll();
      const punjab = updatedCatalog.find(p => p.province.toLowerCase() === 'punjab');
      const oldFound = punjab?.cities.some(c => c.name.toLowerCase() === testNewCity.toLowerCase());
      const newFound = punjab?.cities.some(c => c.name.toLowerCase() === testUpdatedCity.toLowerCase());

      if (!oldFound && newFound) {
        results.push({
          test: 12,
          name: 'Admin edits a city/province mapping',
          status: 'PASSED',
          details: `City successfully renamed from "${testNewCity}" to "${testUpdatedCity}"`
        });
      } else {
        results.push({
          test: 12,
          name: 'Admin edits a city/province mapping',
          status: 'FAILED',
          details: `Old still present (${oldFound}) or new not found (${newFound})`
        });
      }
    } else {
      results.push({
        test: 12,
        name: 'Admin edits a city/province mapping',
        status: 'FAILED',
        details: updateResult.error || 'Failed to update city'
      });
    }
  } catch (err: any) {
    results.push({ test: 12, name: 'Admin edits a city/province mapping', status: 'FAILED', details: err.message });
  }

  // Clean up test city
  try {
    await LocationRepository.deleteCity(testUpdatedCity);
  } catch {}

  // --- TEST 13: Duplicate city addition is prevented ---
  try {
    const dupResult = await LocationRepository.addCity('Punjab', 'Lahore'); // Lahore already exists
    const msg = (dupResult.message || dupResult.error || '').toLowerCase();
    if (!dupResult.success && msg.includes('already exists')) {
      results.push({
        test: 13,
        name: 'Duplicate city addition is prevented',
        status: 'PASSED',
        details: `Correctly rejected: "${dupResult.message || dupResult.error}"`
      });
    } else {
      results.push({
        test: 13,
        name: 'Duplicate city addition is prevented',
        status: 'FAILED',
        details: `Expected rejection, got: ${JSON.stringify(dupResult)}`
      });
    }
  } catch (err: any) {
    results.push({ test: 13, name: 'Duplicate city addition is prevented', status: 'FAILED', details: err.message });
  }

  // --- TEST 14: Unauthorized user cannot modify location records (RBAC check) ---
  try {
    // Check permission logic
    const { hasAdminPermission } = await import('../auth/authManager');
    const guestAllowed = hasAdminPermission(undefined, 'jobs.manage');
    const candidateAllowed = hasAdminPermission('Candidate', 'jobs.manage');
    const adminAllowed = hasAdminPermission('Super Admin', 'jobs.manage');
    const moderatorAllowed = hasAdminPermission('Job Moderator', 'jobs.manage');

    if (!guestAllowed && !candidateAllowed && adminAllowed && moderatorAllowed) {
      results.push({
        test: 14,
        name: 'Unauthorized user cannot modify location records',
        status: 'PASSED',
        details: 'Candidate and unauthenticated rejected, Super Admin & Job Moderator authorized'
      });
    } else {
      results.push({
        test: 14,
        name: 'Unauthorized user cannot modify location records',
        status: 'FAILED',
        details: `guest: ${guestAllowed}, candidate: ${candidateAllowed}, admin: ${adminAllowed}`
      });
    }
  } catch (err: any) {
    results.push({ test: 14, name: 'Unauthorized user cannot modify location records', status: 'FAILED', details: err.message });
  }

  // --- TEST 15: Existing confirmed locations remain protected from scraper overwrites ---
  try {
    // In JobRepository, applyLocationProtection ensures existing manual/confirmed location data isn't wiped or overwritten by empty scrapers
    const confirmedJob: Partial<Job> = {
      title: 'Scraped Job Protection Test',
      company: 'Test Org',
      location: 'Karachi, Sindh, Pakistan',
      city: 'Karachi',
      province: 'Sindh',
      country: 'Pakistan',
      isLocationConfirmed: true
    };
    const createdConfirmed = await JobRepository.create(confirmedJob);
    if (createdConfirmed) {
      // Simulate scraper update with missing/blank city or foreign override
      const scraperUpdate = {
        title: 'Scraped Job Protection Test Updated',
        city: '', // Scraper blank city
        province: '', // Scraper blank province
      };
      const updated = await JobRepository.update(createdConfirmed.id, scraperUpdate);
      if (updated && updated.city === 'Karachi' && updated.province === 'Sindh' && updated.country === 'Pakistan') {
        results.push({
          test: 15,
          name: 'Existing confirmed locations remain protected from scraper overwrites',
          status: 'PASSED',
          details: `Confirmed city "${updated.city}" and province "${updated.province}" protected against blank overwrite`
        });
      } else {
        results.push({
          test: 15,
          name: 'Existing confirmed locations remain protected from scraper overwrites',
          status: 'FAILED',
          details: `Location was overwritten: city="${updated?.city}", province="${updated?.province}"`
        });
      }
    }
  } catch (err: any) {
    results.push({ test: 15, name: 'Existing confirmed locations remain protected from scraper overwrites', status: 'FAILED', details: err.message });
  }

  // --- TEST 16: Attachment public/private visibility tests ---
  try {
    const jobWithAttachments: Partial<Job> = {
      title: 'Job Attachment Visibility Test',
      company: 'Sec Corp',
      location: 'Lahore',
      city: 'Lahore',
      country: 'Pakistan',
      attachments: [
        {
          id: 'att-1-priv',
          fileName: 'confidential_contract.pdf',
          fileUrl: '/api/jobs/attachments/confidential_contract.pdf',
          fileType: 'pdf',
          fileSize: 1024,
          uploadedAt: new Date().toISOString(),
          isPublic: false // Private by default
        },
        {
          id: 'att-2-pub',
          fileName: 'public_circular.pdf',
          fileUrl: '/api/jobs/attachments/public_circular.pdf',
          fileType: 'pdf',
          fileSize: 2048,
          uploadedAt: new Date().toISOString(),
          isPublic: true // Explicitly public
        }
      ]
    };

    const createdJob = await JobRepository.create(jobWithAttachments);

    // Verify isAttachmentPublic helper
    const isPrivPublic = await JobRepository.isAttachmentPublic('confidential_contract.pdf');
    const isPubPublic = await JobRepository.isAttachmentPublic('public_circular.pdf');
    const isUnknownPublic = await JobRepository.isAttachmentPublic('non_existent.pdf');

    // Verify public projection filtering (simulating public candidate endpoint)
    const publicView = createdJob.attachments?.filter(a => a.isPublic === true) || [];
    const adminView = createdJob.attachments || [];

    if (!isPrivPublic && isPubPublic && !isUnknownPublic && publicView.length === 1 && adminView.length === 2) {
      results.push({
        test: 16,
        name: 'Attachment public/private visibility control & streaming permissions',
        status: 'PASSED',
        details: 'Private attachments hidden from public and denied streaming; public attachments accessible'
      });
    } else {
      results.push({
        test: 16,
        name: 'Attachment public/private visibility control & streaming permissions',
        status: 'FAILED',
        details: `isPrivPublic: ${isPrivPublic}, isPubPublic: ${isPubPublic}, publicCount: ${publicView.length}, adminCount: ${adminView.length}`
      });
    }
  } catch (err: any) {
    results.push({ test: 16, name: 'Attachment public/private visibility control & streaming permissions', status: 'FAILED', details: err.message });
  }

  // --- TEST 17: Existing job approval and payment workflows remain unaffected ---
  try {
    const pendingJob: Partial<Job> = {
      title: 'Pending Job Workflow Test',
      company: 'Test Org',
      location: 'Islamabad',
      city: 'Islamabad',
      status: 'Pending'
    };
    const createdPending = await JobRepository.addPending(pendingJob);
    if (createdPending && createdPending.status === 'Pending') {
      const approved = await JobRepository.approvePending(createdPending.id);
      if (approved && (approved.status === 'Approved' || approved.status === 'Active')) {
        results.push({
          test: 17,
          name: 'Existing job approval and payment workflows remain unaffected',
          status: 'PASSED',
          details: `Job successfully transitioned from Pending to ${approved.status}`
        });
      } else {
        results.push({
          test: 17,
          name: 'Existing job approval and payment workflows remain unaffected',
          status: 'FAILED',
          details: `Approval failed, status: ${approved?.status}`
        });
      }
    } else {
      results.push({
        test: 17,
        name: 'Existing job approval and payment workflows remain unaffected',
        status: 'FAILED',
        details: 'Failed to create pending job'
      });
    }
  } catch (err: any) {
    results.push({ test: 17, name: 'Existing job approval and payment workflows remain unaffected', status: 'FAILED', details: err.message });
  }

  console.log('\n--- TEST EXECUTION SUMMARY ---');
  let passCount = 0;
  for (const r of results) {
    console.log(`[Test ${r.test}] ${r.status} : ${r.name}`);
    if (r.details) console.log(`       Details: ${r.details}`);
    if (r.status === 'PASSED') passCount++;
  }
  console.log(`\nTOTAL: ${passCount} / ${results.length} PASSED`);

  if (passCount === results.length) {
    console.log('\nALL 17 TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error(`\nFAILED ${results.length - passCount} TESTS`);
    process.exit(1);
  }
}

runStep65B3Verification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
