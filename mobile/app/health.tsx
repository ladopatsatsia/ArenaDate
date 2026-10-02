import { Redirect } from 'expo-router';
import { HealthScreen } from '../src/components/HealthScreen';
export default function Health() { return __DEV__ ? <HealthScreen /> : <Redirect href="/" />; }
