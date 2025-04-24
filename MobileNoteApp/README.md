# Welcome to the Mobile Note App 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. First, you have to start the backend server
- Go to the backend folder.
   ```bash
   cd ../backend
   ```
- Follow the instruction there to start the server side.
- Find the local network address for accessing on the mobile device.
- For example: 
   When running the server, it will be available at:
   - `http://127.0.0.1:8080` (localhost, for accessing from the same machine)
   - `http://26.26.26.1:8080` (local network address, for accessing from other devices)

2. From Mobile Devices

To connect from your iPad or other mobile devices:
- Make sure your mobile device is connected to the same WiFi network as the server
- Verify the actual IP address of your server
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
- Use the first IP address as the base URL in your mobile app
- API endpoints can be accessed at `http://xx.xx.xx.xx.8080/api/...`
- Go to /MobileNoteApp/hooks/api.ts and fill in the base API configuration
   ```bash
   const BASE_URL = 'http://xx.xx.xx.xx:8080/api';
   ```

3. Install dependencies

   ```bash
   npm install
   ```

3. Start the app and give it a try!

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

The easiest way is to scan the Expo Go code shown in the terminal and play with it!
