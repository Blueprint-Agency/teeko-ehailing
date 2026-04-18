.PHONY: help apk ios ios-simulator ios-device dev-android dev-ios login init tunnel

EAS := pnpm dlx eas-cli

help:
	@echo "Teeko rider app — build targets"
	@echo ""
	@echo "  make apk         Build an installable Android APK (preview profile)"
	@echo "  make ios         Push an EAS Update to preview channel for Expo Go sharing"
	@echo "  make ios-simulator Build an iOS simulator .tar.gz (no Apple account needed)"
	@echo "  make ios-device  Build an iOS device .ipa (requires Apple Dev account)"
	@echo "  make dev-android Build an Android dev-client APK"
	@echo "  make dev-ios     Build an iOS dev-client simulator build"
	@echo "  make login       Log in to Expo / EAS"
	@echo "  make init        Link this project to your Expo account (first-time setup)"
	@echo "  make tunnel      Start Expo dev server with tunnel (share via QR to Expo Go)"

login:
	$(EAS) login

init:
	$(EAS) init

apk:
	$(EAS) build -p android --profile preview

ios:
	$(EAS) update --channel preview --message "client demo"

ios-simulator:
	$(EAS) build -p ios --profile simulator

ios-device:
	$(EAS) build -p ios --profile preview

dev-android:
	$(EAS) build -p android --profile development

dev-ios:
	$(EAS) build -p ios --profile development

tunnel:
	npx expo start --tunnel

