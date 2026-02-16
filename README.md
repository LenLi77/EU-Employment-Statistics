# EU Employment Statistics

A real-time dashboard displaying employment statistics for all 27 EU countries, powered by Eurostat API.

![Dashboard Preview](preview.png)

## Features

- 📊 **Live Data** - Fetches directly from Eurostat API
- 🔄 **24-Hour Cache** - Fast loading with automatic daily refresh
- 🇪🇺 **All EU 27** - Complete coverage of EU member states
- 📈 **Interactive Charts** - Compare countries or view historical trends
- 💰 **Income Tax Info** - 2024 tax brackets for each country
- 📱 **Responsive** - Works on desktop and mobile

## Data Sources

| Metric | Eurostat Dataset | Update Frequency |
|--------|------------------|------------------|
| Unemployment Rate | une_rt_m | Monthly |
| Employment Count | lfsi_emp_a | Annual |
| Average Salary | earn_ses_pub2s | Every 4 years |
| Median Salary | earn_ses_pub2s | Every 4 years |
| Income Tax | Manual | Annual |

## Tech Stack

- **Framework**: Next.js 14
- **Charts**: Recharts
- **Styling**: Inline CSS (no dependencies)
- **Deployment**: Vercel

## Local Development
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

Push to GitHub and import to Vercel - auto-deploys on every commit.

## Embed on Your Website
```html
<iframe 
  src="https://your-app.vercel.app" 
  width="100%" 
  height="800" 
  frameborder="0">
</iframe>
```

## License

MIT
