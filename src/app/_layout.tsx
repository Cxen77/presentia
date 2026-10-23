import React from 'react';
import { Stack } from 'expo-router';
import { LocationIntegrityNotice } from '../components/LocationIntegrityNotice';
export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#061522' },
        }}
      />
      <LocationIntegrityNotice />
    </>
  );
}
