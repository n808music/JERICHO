import { callClaudeForSessionPlan } from './src/state/mockLLMActionGraph.ts';

const goalText = 'Launch commercial gum sale with product sourcing, checkout integration, buyer outreach, and conversion tracking';

const mockResult = {
  graph: {
    actions: [
      { id: 'a1', title: 'Product Sourcing' },
      { id: 'a2', title: 'Checkout Setup' },
      { id: 'a3', title: 'Communications' },
      { id: 'a4', title: 'Buyer Outreach' },
      { id: 'a5', title: 'Response Tracking' }
    ]
  }
};

const sessionResult = callClaudeForSessionPlan(
  {
    wellformedContract: {
      id: 'test-contract',
      status: 'active'
    },
    contract: {
      executionType: 'BrandLaunch',
      goalText,
      temporalBinding: { startDayKey: '2026-01-01' },
      deadline: { dayKey: '2026-12-31' }
    },
    actions: mockResult.graph.actions,
    nowISO: '2026-01-15T12:00:00Z'
  },
  'test-key'
);

if (sessionResult.ok) {
  const dates = sessionResult.sessions.map(s => s.date);
  console.log(`Total sessions: ${dates.length}`);
  console.log(`Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  
  // Group by month
  const byMonth = {};
  dates.forEach(d => {
    const month = d.substring(0, 7);
    byMonth[month] = (byMonth[month] || 0) + 1;
  });
  
  console.log('\nSessions by month:');
  Object.entries(byMonth).sort().forEach(([month, count]) => {
    console.log(`  ${month}: ${count} sessions`);
  });
  
  // Find outreach and response tracking sessions
  const outreach = sessionResult.sessions.filter(s => s.title?.toLowerCase().includes('outreach'));
  const tracking = sessionResult.sessions.filter(s => s.title?.toLowerCase().includes('review') || s.title?.toLowerCase().includes('response') || s.title?.toLowerCase().includes('tracking'));
  
  if (outreach.length > 0) {
    console.log(`\nOutreach sessions: ${outreach.length} (dates: ${outreach.map(s => s.date).slice(0, 3).join(', ')}...)`);
  }
  if (tracking.length > 0) {
    console.log(`Response tracking sessions: ${tracking.length} (dates: ${tracking.map(s => s.date).slice(0, 3).join(', ')}...)`);
  }
}
