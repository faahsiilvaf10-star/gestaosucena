const url = 'https://svacqjpyjniejqfmuwhl.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YWNxanB5am5pZWpxZm11d2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNjQ1NTEsImV4cCI6MjEwMzk0MDU1MX0.P9bIBEhpyn42g3WVo7owIt87p9f4Vzx1xtq2aCzmDkc';

fetch(url)
  .then(r => r.text())
  .then(data => {
    console.log(data);
  })
  .catch(console.error);
