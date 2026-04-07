import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface RegisterFormProps {
  onSubmit: (email: string, username: string, password: string) => void;
  isLoading?: boolean;
}

export function RegisterForm({ onSubmit, isLoading = false }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; username?: string; password?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string; username?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!username) {
      newErrors.username = 'Display name is required';
    } else if (username.length < 2) {
      newErrors.username = 'Display name must be at least 2 characters';
    } else if (username.length > 50) {
      newErrors.username = 'Display name must be less than 50 characters';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(email, username, password);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Input
        label="Email Address"
        placeholder="name@company.com"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (errors.email) setErrors({ ...errors, email: undefined });
        }}
        error={errors.email}
        disabled={isLoading}
        required
      />
      <Input
        label="Display Name"
        placeholder="e.g. Alex"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          if (errors.username) setErrors({ ...errors, username: undefined });
        }}
        error={errors.username}
        disabled={isLoading}
        required
        minLength={2}
        maxLength={50}
      />
      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (errors.password) setErrors({ ...errors, password: undefined });
        }}
        error={errors.password}
        disabled={isLoading}
        required
        minLength={8}
      />
      <Button 
        type="submit" 
        variant="primary" 
        className="w-full h-11 text-base font-bold"
        disabled={isLoading}
      >
        {isLoading ? 'Creating Account...' : 'Create Account'}
      </Button>
    </form>
  );
}
