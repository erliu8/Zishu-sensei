This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 🚀 Performance Optimization

This project includes comprehensive performance optimization features:

### Available Scripts

```bash
# Performance analysis
npm run perf:check        # Check bundle size and performance budget
npm run perf:lighthouse   # Run Lighthouse CI
npm run analyze          # Analyze bundle with visualization

# Development
npm run dev              # Start dev server with performance monitoring
npm run build            # Production build with optimizations
```

### Performance Features

- ✅ **Web Vitals Monitoring**: Automatic tracking of Core Web Vitals (LCP, FID, CLS)
- ✅ **Code Splitting**: Automatic route-based and component-based splitting
- ✅ **Image Optimization**: WebP/AVIF support with responsive images
- ✅ **Virtual Scrolling**: Optimized rendering for long lists
- ✅ **Advanced Caching**: Multiple caching strategies (Cache First, Network First, SWR)
- ✅ **Resource Preloading**: Smart preloading of critical resources
- ✅ **Bundle Analysis**: Automatic bundle size checking

### Performance Targets

| Metric | Target |
|--------|--------|
| Lighthouse Performance | ≥ 90 |
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| Bundle Size (gzipped) | < 200KB |

### Documentation

- 📖 [Performance Optimization Guide](./docs/PERFORMANCE_OPTIMIZATION_GUIDE.md)
- 📊 [Performance Summary](./docs/PERFORMANCE_OPTIMIZATION_SUMMARY.md)
- 📋 [Improvement Plan](./docs/IMPROVEMENT_PLAN.md)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
