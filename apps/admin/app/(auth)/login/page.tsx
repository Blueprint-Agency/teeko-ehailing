'use client';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, Table, TableBody, TableRow, TableCell, Divider, Chip,
} from '@mui/material';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/auth';
import { MOCK_ACCOUNTS, ROLE_LABELS, ROLE_COLORS } from '@/lib/mock-accounts';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAdminAuthStore((s) => s.login);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = login(email, password);
    if (ok) router.push('/dashboard');
    else setError('Invalid email or password.');
  };

  const fillAccount = (idx: number) => {
    setEmail(MOCK_ACCOUNTS[idx].email);
    setPassword(MOCK_ACCOUNTS[idx].password);
    setError('');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', bgcolor: 'background.default', p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 900, display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        {/* Login form */}
        <Card sx={{ flex: 1, maxWidth: 400 }} elevation={2}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Box sx={{ width: 32, height: 32, bgcolor: 'primary.main', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>T</Typography>
              </Box>
              <Typography variant="h6" fontWeight={700}>Teeko Admin</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={2.5}>
              Sign in to the operations panel
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <form onSubmit={handleSubmit}>
              <TextField
                label="Email" type="email" fullWidth size="small"
                value={email} onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 1.5 }} required
              />
              <TextField
                label="Password" type="password" fullWidth size="small"
                value={password} onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 2.5 }} required
              />
              <Button type="submit" variant="contained" fullWidth>Sign in</Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo accounts panel */}
        <Card sx={{ flex: 1 }} elevation={1}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} mb={0.5}>Demo Accounts</Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Click any row to autofill credentials. Password: <code>demo1234</code>
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Table size="small">
              <TableBody>
                {MOCK_ACCOUNTS.map((acc, idx) => (
                  <TableRow
                    key={acc.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => fillAccount(idx)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{acc.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{acc.email}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={ROLE_LABELS[acc.role]} color={ROLE_COLORS[acc.role]} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
