import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface RegisterFormProps {
  onSubmit: (email: string, username: string, password: string) => void;
}

export function RegisterForm({ onSubmit }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(email, username, password);
      }}
    >
      <Input
        label="Email Address"
        placeholder="name@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Display Name"
        placeholder="e.g. Alex"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" variant="primary" className="w-full h-11 text-base font-bold">Create Account</Button>
    </form>
  );
}
