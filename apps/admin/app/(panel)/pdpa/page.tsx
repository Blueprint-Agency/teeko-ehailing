'use client';
import {
  Box, Typography, Grid, Card, CardContent, Button, Alert,
  Stack, Chip, Table, TableBody, TableRow, TableCell,
} from '@mui/material';
import { useRbac } from '@/hooks/useRbac';
import { useState } from 'react';

const ERASURE_REQUESTS = [
  { id: 'er1', name: 'Mohd Nabil Bin Razak', type: 'rider', requestDate: '2026-05-10', reason: 'User-initiated account deletion', status: 'pending' },
  { id: 'er2', name: 'Normah Binti Ahmad',  type: 'driver', requestDate: '2026-05-08', reason: 'PDPA right to erasure request',    status: 'completed' },
];

const CONSENT_LOG = [
  { id: 'cl1', userId: 'r1', name: 'Aishah Bt Nordin', action: 'marketing_consent_granted', date: '2024-03-10' },
  { id: 'cl2', userId: 'r2', name: 'Marcus Tan',       action: 'marketing_consent_withdrawn', date: '2025-08-22' },
  { id: 'cl3', userId: 'd1', name: 'Ahmad Faris',      action: 'data_processing_consent_granted', date: '2024-01-15' },
];

export default function PdpaPage() {
  const { can } = useRbac();
  const [done, setDone] = useState('');

  if (!can('pdpa_tools')) {
    return <Box p={4}><Alert severity="warning">Access restricted — Super Admin only.</Alert></Box>;
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>PDPA Tools</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Erasure Requests</Typography>
              <Table size="small">
                <TableBody>
                  {ERASURE_REQUESTS.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{r.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{r.reason}</Typography>
                      </TableCell>
                      <TableCell><Chip label={r.type} size="small" color={r.type === 'rider' ? 'info' : 'secondary'} /></TableCell>
                      <TableCell><Chip label={r.status} size="small" color={r.status === 'completed' ? 'success' : 'warning'} /></TableCell>
                      <TableCell>
                        {r.status === 'pending' && (
                          <Button size="small" variant="outlined" color="error" onClick={() => setDone(`Erasure completed for ${r.name}.`)}>Execute</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={600}>SAR Export</Typography>
                <Button size="small" variant="outlined" onClick={() => setDone('SAR export prepared.')}>Export All</Button>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Subject Access Request — export all personal data held for a specific user as JSON.
              </Typography>
              <Stack spacing={1}>
                {['r1', 'r9', 'd10'].map((uid) => (
                  <Box key={uid} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption">User {uid}</Typography>
                    <Button size="small" onClick={() => setDone(`SAR export for ${uid} downloaded.`)}>Download</Button>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Consent Log</Typography>
              <Table size="small">
                <TableBody>
                  {CONSENT_LOG.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><Typography variant="caption">{c.name}</Typography></TableCell>
                      <TableCell><Chip label={c.action.replace(/_/g, ' ')} size="small" color={c.action.includes('granted') ? 'success' : 'error'} /></TableCell>
                      <TableCell><Typography variant="caption">{c.date}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
