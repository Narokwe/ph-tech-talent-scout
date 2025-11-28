import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFunctions, provideFunctions } from '@angular/fire/functions';
import {
  provideQueryClient,
  QueryClient,
} from '@tanstack/angular-query-experimental';

const firebaseConfig = {
  apiKey: "AIzaSyChLZ7SaxA7xytEFzjI2brBeovaQCRHUJA",
  authDomain: "ph-tech-talent-scout.firebaseapp.com",
  projectId: "ph-tech-talent-scout",
  storageBucket: "ph-tech-talent-scout.firebasestorage.app",
  messagingSenderId: "528589818488",
  appId: "1:528589818488:web:33671a963e33cfe31e3b8d"
};

const queryClient = new QueryClient({});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideQueryClient(queryClient),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFunctions(() => getFunctions()),
  ],
};