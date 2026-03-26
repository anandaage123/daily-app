#!/bin/bash
echo "Building Daily Life APK..."

# 1. Build the release APK
npx expo run:android --variant release

# 2. Find the generated APK and copy it to the root folder with a clean name
APK_PATH=$(find android/app/build/outputs/apk/release -name "*.apk" | head -n 1)

if [ -f "$APK_PATH" ]; then
    rm ../DailyLife.apk
    cp "$APK_PATH" ../DailyLife.apk
    echo "------------------------------------------------"
    echo "SUCCESS: APK created at ./DailyLife.apk"
    echo "Installing to your device now..."
    adb install ../DailyLife.apk
    echo "------------------------------------------------"
else
    echo "Error: APK build failed or file not found."
fi
