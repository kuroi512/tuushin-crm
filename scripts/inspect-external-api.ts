// Test script to fetch external shipment data and show structure
import 'dotenv/config';

const EXTERNAL_API_BASE = 'https://burtgel.tuushin.mn/api/crm';

function getBasicAuthHeader() {
  const username = process.env.TUUSHIN_EXTERNAL_CRM_USERNAME;
  const password = process.env.TUUSHIN_EXTERNAL_CRM_PASSWORD;
  if (!username || !password) {
    console.error('❌ Missing credentials:');
    console.error('  - TUUSHIN_EXTERNAL_CRM_USERNAME:', username ? '✓ set' : '✗ missing');
    console.error('  - TUUSHIN_EXTERNAL_CRM_PASSWORD:', password ? '✓ set' : '✗ missing');
    throw new Error('Missing external API credentials in environment variables.');
  }
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
}

async function fetchSampleData(category: 'import' | 'transit' | 'export') {
  const endpoints = {
    import: 'import-cargo',
    transit: 'transit-cargo',
    export: 'export-cargo',
  };

  // Use last 3 days for testing
  const today = new Date();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);

  const beginDate = threeDaysAgo.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  const payload = {
    type: category === 'import' ? 1 : 2,
    beginDate,
    endDate,
    page: 1,
  };

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 Fetching ${category.toUpperCase()} shipments`);
  console.log(`   Date range: ${beginDate} to ${endDate}`);
  console.log(`   Filter type: ${payload.type}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const url = `${EXTERNAL_API_BASE}/${endpoints[category]}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: getBasicAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP ${response.status} ${response.statusText}`);
      console.error('Response:', errorText.substring(0, 500));
      return;
    }

    const data = await response.json();

    console.log('✅ Response received successfully\n');
    console.log('Response metadata:');
    console.log('  - Current page:', data.current_page || 'N/A');
    console.log('  - Last page:', data.last_page || 'N/A');
    console.log('  - Records count:', Array.isArray(data.data) ? data.data.length : 0);
    console.log('  - Next page URL:', data.next_page_url || 'N/A');

    if (Array.isArray(data.data) && data.data.length > 0) {
      console.log('\n📋 Sample Record Structure (First Record):');
      console.log('─'.repeat(80));

      const firstRecord = data.data[0];
      const fields = Object.keys(firstRecord).sort();

      console.log(`\nTotal fields: ${fields.length}\n`);

      // Group fields by category for better readability
      const fieldsByType: Record<string, string[]> = {
        'ID & References': [],
        'Dates & Times': [],
        'Amounts & Numbers': [],
        'Text & Description': [],
        'Status & Category': [],
        Other: [],
      };

      fields.forEach((field) => {
        const value = firstRecord[field];
        const valueType = typeof value;
        const fieldLower = field.toLowerCase();

        if (
          fieldLower.includes('id') ||
          fieldLower.includes('number') ||
          fieldLower.includes('dugaar')
        ) {
          fieldsByType['ID & References'].push(field);
        } else if (
          fieldLower.includes('date') ||
          fieldLower.includes('time') ||
          fieldLower.includes('at')
        ) {
          fieldsByType['Dates & Times'].push(field);
        } else if (
          fieldLower.includes('amount') ||
          fieldLower.includes('cost') ||
          fieldLower.includes('price') ||
          fieldLower.includes('une') ||
          fieldLower.includes('profit')
        ) {
          fieldsByType['Amounts & Numbers'].push(field);
        } else if (
          fieldLower.includes('name') ||
          fieldLower.includes('description') ||
          fieldLower.includes('ner')
        ) {
          fieldsByType['Text & Description'].push(field);
        } else if (
          fieldLower.includes('status') ||
          fieldLower.includes('type') ||
          fieldLower.includes('torol')
        ) {
          fieldsByType['Status & Category'].push(field);
        } else {
          fieldsByType['Other'].push(field);
        }
      });

      Object.entries(fieldsByType).forEach(([category, fields]) => {
        if (fields.length > 0) {
          console.log(`\n${category}:`);
          fields.forEach((field) => {
            const value = firstRecord[field];
            const displayValue =
              value === null
                ? 'null'
                : value === undefined
                  ? 'undefined'
                  : typeof value === 'object'
                    ? JSON.stringify(value).substring(0, 50) + '...'
                    : String(value).length > 50
                      ? String(value).substring(0, 50) + '...'
                      : String(value);
            console.log(`  ${field.padEnd(30)} = ${displayValue}`);
          });
        }
      });

      console.log('\n' + '─'.repeat(80));
      console.log('\n📄 Full first record (JSON):');
      console.log(JSON.stringify(firstRecord, null, 2));

      // Show all field names in a compact list
      console.log('\n' + '─'.repeat(80));
      console.log('\n📝 All field names (alphabetically):');
      const columns = 3;
      const columnWidth = 30;
      for (let i = 0; i < fields.length; i += columns) {
        const row = fields
          .slice(i, i + columns)
          .map((f) => f.padEnd(columnWidth))
          .join('');
        console.log(`  ${row}`);
      }
    } else {
      console.log('\n⚠️  No records found in the specified date range.');
      console.log('Try expanding the date range or checking a different category.');
    }
  } catch (error) {
    console.error('\n❌ Error fetching data:', error instanceof Error ? error.message : error);
  }
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 EXTERNAL SHIPMENT API FIELD INSPECTOR');
  console.log('='.repeat(80));

  // Test import category first (most common)
  await fetchSampleData('import');

  console.log('\n\n' + '='.repeat(80));
  console.log('✨ Inspection complete!');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
