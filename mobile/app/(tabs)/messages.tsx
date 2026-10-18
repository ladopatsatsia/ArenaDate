import React from 'react';
import { Redirect } from 'expo-router';

export default function MessagesRedirect() {
  return <Redirect href="/(tabs)/matches" />;
}
