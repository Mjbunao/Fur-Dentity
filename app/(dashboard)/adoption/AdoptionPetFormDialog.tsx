'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { AddRoundedIcon, CloseRoundedIcon, SaveRoundedIcon } from '@/components/icons';
import type { AdoptionBreedOptions, AdoptionPetFormPayload, AdoptionPetRow } from './types';

type AdoptionPetFormDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  pet: AdoptionPetRow | null;
  breedOptions: AdoptionBreedOptions;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: AdoptionPetFormPayload) => Promise<void> | void;
};

const defaultForm = (): AdoptionPetFormPayload => ({
  petName: '',
  petAge: '',
  type: '',
  gender: '',
  breed: '',
  description: '',
  profileURL: '',
});

export default function AdoptionPetFormDialog({
  open,
  mode,
  pet,
  breedOptions,
  loading = false,
  onClose,
  onSubmit,
}: AdoptionPetFormDialogProps) {
  const initialForm = useMemo<AdoptionPetFormPayload>(() => {
    if (mode === 'edit' && pet) {
      return {
        petName: pet.petName,
        petAge: pet.petAge,
        type: pet.type,
        gender: pet.gender,
        breed: pet.breed,
        description: pet.description,
        profileURL: pet.profileURL === '/Profile.webp' ? '' : pet.profileURL,
      };
    }

    return defaultForm();
  }, [mode, pet]);

  const [form, setForm] = useState<AdoptionPetFormPayload>(initialForm);
  const [error, setError] = useState('');
  const availableBreeds =
    form.type === 'Dog' ? breedOptions.dogBreeds : form.type === 'Cat' ? breedOptions.catBreeds : [];

  const handleChange = <K extends keyof AdoptionPetFormPayload>(key: K, value: AdoptionPetFormPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!form.type || !form.gender || !form.breed.trim()) {
      setError('Type, gender, and breed are required.');
      return;
    }

    await onSubmit({
      ...form,
      petName: form.petName.trim(),
      petAge: form.petAge.trim(),
      breed: form.breed.trim(),
      description: form.description.trim(),
      profileURL: form.profileURL.trim(),
    });
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1 }}>
        {mode === 'create' ? 'Add Pet for Adoption' : 'Edit Adoption Pet'}
        <DialogContentText sx={{ mt: 0.75, color: 'text.secondary' }}>
          {mode === 'create'
            ? 'Create a shelter pet entry that can receive adoption requests from mobile users.'
            : 'Update the shelter pet information shown to adopters.'}
        </DialogContentText>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Name"
                size="small"
                fullWidth
                value={form.petName}
                onChange={(event) => handleChange('petName', event.target.value)}
                disabled={loading}
              />
              <TextField
                label="Age"
                size="small"
                fullWidth
                value={form.petAge}
                onChange={(event) => handleChange('petAge', event.target.value)}
                disabled={loading}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel id="adoption-type-label">Type</InputLabel>
                <Select
                  labelId="adoption-type-label"
                  label="Type"
                  value={form.type}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    setForm((current) => ({
                      ...current,
                      type: nextType,
                      breed: current.type === nextType ? current.breed : '',
                    }));
                  }}
                  disabled={loading}
                >
                  <MenuItem value="Dog">Dog</MenuItem>
                  <MenuItem value="Cat">Cat</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel id="adoption-gender-label">Gender</InputLabel>
                <Select
                  labelId="adoption-gender-label"
                  label="Gender"
                  value={form.gender}
                  onChange={(event) => handleChange('gender', event.target.value)}
                  disabled={loading}
                >
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <FormControl size="small" fullWidth disabled={loading || !form.type}>
              <InputLabel id="adoption-breed-label">Breed</InputLabel>
              <Select
                labelId="adoption-breed-label"
                label="Breed"
                value={form.breed}
                onChange={(event) => handleChange('breed', event.target.value)}
              >
                {availableBreeds.length === 0 ? (
                  <MenuItem value="" disabled>
                    {form.type ? 'No breeds available' : 'Select a pet type first'}
                  </MenuItem>
                ) : null}
                {availableBreeds.map((breed) => (
                  <MenuItem key={breed} value={breed}>
                    {breed}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Image URL"
              size="small"
              fullWidth
              value={form.profileURL}
              onChange={(event) => handleChange('profileURL', event.target.value)}
              disabled={loading}
              placeholder="Optional, defaults to local placeholder"
            />
            <TextField
              label="Description"
              size="small"
              fullWidth
              multiline
              minRows={3}
              value={form.description}
              onChange={(event) => handleChange('description', event.target.value)}
              disabled={loading}
            />

            {error ? <Alert severity="error">{error}</Alert> : null}

            <DialogActions sx={{ px: 0, pb: 0, pt: 0.5 }}>
              <Button onClick={onClose} disabled={loading} startIcon={<CloseRoundedIcon sx={{ fontSize: 18 }} />}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={mode === 'create' ? <AddRoundedIcon sx={{ fontSize: 18 }} /> : <SaveRoundedIcon sx={{ fontSize: 18 }} />}
              >
                {mode === 'create' ? 'Save pet' : 'Update pet'}
              </Button>
            </DialogActions>
          </Stack>
        </form>
      </DialogContent>
    </Dialog>
  );
}
