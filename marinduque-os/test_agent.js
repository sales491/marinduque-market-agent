fetch('http://localhost:3001/api/harvester-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: "Run a broad discovery for 'Cafes in Boac, Marinduque'. Select the top 1 and verify their social media presence." })
})
.then(r => r.json())
.then(data => require('fs').writeFileSync('test_output.json', JSON.stringify(data, null, 2)))
.catch(console.error);
