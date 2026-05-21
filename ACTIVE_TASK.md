# LingJing IDE - Task Tracker 
 
## Current Status: v1.46.5 Desktop | v1.33.1 Mobile 
 
### Latest Desktop: v1.46.5 
Fix: admin login 401 + version review workflow + cloud sync heartbeat 
 
### Latest Mobile: v1.33.1 
Fix: ErrorBoundary, route safety, WebSocket heartbeat 
 
### Changes in v1.33.1 Mobile 
- **ErrorBoundary**: New src/components/ErrorBoundary.tsx wrapping entire app 
- **ChatDetailScreen**: route?.params safety + Alert on send failure 
- **WebSocket Heartbeat**: 30s ping in api.ts (same pattern as desktop) 
- **App.tsx**: Outer ErrorBoundary wrapping SafeAreaProvider 
 
### Git Status 
- main@7436569d0 ¡ª OK (Local/Server/GitHub) 
 
### Service Health 
- PM2: 4/4 online 
- nginx: all endpoints 200 
- Mobile TSC: only pre-existing uuid error 
 
### APK Build Status 
- **Blocked**: EAS CLI requires Expo login credentials 
- **Manual steps**: eas login (needs Expo account credentials) && eas build -p android --profile preview 
- **Upload**: scp *.apk root@120.55.5.220:/var/www/html/apk/ 
- **Publish**: Admin panel -> POST /api/versions -> submit-review -> publish
