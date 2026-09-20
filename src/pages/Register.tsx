import React from 'react';
import { CaregiverSignup } from './CaregiverSignup';

interface RegisterProps {
  onNavigate: (page: string) => void;
}

/**
 * Public registration is strictly Caregiver Account Creation.
 * Patient accounts cannot be created publicly and are provisioned
 * exclusively by caregivers via the Caregiver Setup Wizard.
 */
export const Register: React.FC<RegisterProps> = ({ onNavigate }) => {
  return <CaregiverSignup onNavigate={onNavigate} />;
};
