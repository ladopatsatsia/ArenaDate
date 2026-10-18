import React from 'react';
import { Redirect } from 'expo-router';

export default function SafetyRoute() {
  return <Redirect href="/(tabs)/safety" />;
}
