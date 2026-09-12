import { forwardRef, useMemo, useRef, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { COUNTRIES, COUNTRY_BY_ISO2, type Country } from '@teeko/shared';

import { cn } from '../utils/cn';
import { BottomSheet, type BottomSheetHandle } from './BottomSheet';
import { Icon } from './Icon';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';

// One phone field, two shapes, because the two roles have different rules and
// the difference has to be visible before the user types:
//
//   country="picker" (rider)  — a tappable dial-code chip opening a searchable
//                               country sheet. Riders may be from anywhere.
//   country="fixed"  (driver) — a static '+60' chip, not tappable, with a
//                               helper line. Drivers must be on a Malaysian
//                               mobile: riders dial that number mid-trip.
//
// The value is the *national* number. Composing E.164 is the server's job
// (`resolvePhoneForRole`) so the two surfaces cannot disagree about it.

export interface PhoneInputProps {
  /** Which shape to render. Defaults to the rider's picker. */
  country?: 'picker' | 'fixed';
  /** ISO-3166 alpha-2 of the selected country. Ignored when `country="fixed"`. */
  countryCode?: string;
  onCountryCodeChange?: (iso2: string) => void;
  /** The national number, digits as typed. */
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  error?: string;
  /** Rendered under the field when there is no error. */
  helperText?: string;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
  testID?: string;
  className?: string;
  /**
   * ISO-2s to float to the top of the sheet under "Recent". The app owns the
   * persistence — this package stays storage-free so it can run anywhere.
   */
  recentCountries?: string[];
  /** Fired on every pick, so the app can record the recent itself. */
  onCountryUsed?: (iso2: string) => void;
  /** Copy, so the four locales live in the app's i18n rather than in here. */
  searchPlaceholder?: string;
  recentLabel?: string;
  allCountriesLabel?: string;
  noResultsLabel?: string;
}

const MY = COUNTRY_BY_ISO2.MY!;

export const PhoneInput = forwardRef<TextInput, PhoneInputProps>(function PhoneInput(
  {
    country = 'picker',
    countryCode,
    onCountryCodeChange,
    value,
    onChangeText,
    label,
    error,
    helperText,
    placeholder,
    editable = true,
    autoFocus,
    testID,
    className,
    recentCountries,
    onCountryUsed,
    searchPlaceholder = 'Search country or code',
    recentLabel = 'Recent',
    allCountriesLabel = 'All countries',
    noResultsLabel = 'No matching country',
  },
  ref,
) {
  const sheet = useRef<BottomSheetHandle>(null);
  const [query, setQuery] = useState('');

  const fixed = country === 'fixed';
  // A driver is always MY, whatever the caller passed.
  const selected = fixed ? MY : (COUNTRY_BY_ISO2[countryCode ?? 'MY'] ?? MY);

  const pick = (c: Country) => {
    onCountryCodeChange?.(c.iso2);
    onCountryUsed?.(c.iso2);
    setQuery('');
    sheet.current?.dismiss();
  };

  const chip = (
    <Pressable
      onPress={fixed ? undefined : () => sheet.current?.present()}
      disabled={fixed || !editable}
      accessibilityRole={fixed ? 'text' : 'button'}
      accessibilityLabel={
        fixed
          ? `Country code +${MY.dialCode}, fixed`
          : `Country code +${selected.dialCode}, change country`
      }
      // No press affordance on the driver's chip: nothing happens if you tap it,
      // so it must not look like it would.
      className="flex-row items-center"
    >
      <Text className="text-base">{selected.flag}</Text>
      <Text weight="medium" className="ml-1.5 text-base text-ink-primary">
        +{selected.dialCode}
      </Text>
      {fixed ? null : (
        <Icon name="expand-more" size={18} color="#4B5563" className="ml-0.5" />
      )}
      <View className="ml-3 h-6 w-px bg-border" />
    </Pressable>
  );

  return (
    <View className={className}>
      <Input
        ref={ref}
        label={label}
        error={error}
        leadingAdornment={chip}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        autoFocus={autoFocus}
        testID={testID}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        // The country's own example number, so the expected shape is obvious
        // without a format string nobody reads.
        placeholder={placeholder ?? selected.example}
        maxLength={24}
      />
      {!error && helperText ? (
        <Text tone="secondary" className="mt-1 text-xs">
          {helperText}
        </Text>
      ) : null}

      {fixed ? null : (
        <BottomSheet ref={sheet} showCloseButton onDismiss={() => setQuery('')}>
          <CountrySheet
            query={query}
            onQueryChange={setQuery}
            recentCountries={recentCountries}
            selectedIso2={selected.iso2}
            onPick={pick}
            searchPlaceholder={searchPlaceholder}
            recentLabel={recentLabel}
            allCountriesLabel={allCountriesLabel}
            noResultsLabel={noResultsLabel}
          />
        </BottomSheet>
      )}
    </View>
  );
});

type SheetRow = { kind: 'header'; title: string } | { kind: 'country'; country: Country };

function CountrySheet(props: {
  query: string;
  onQueryChange: (q: string) => void;
  recentCountries?: string[];
  selectedIso2: string;
  onPick: (c: Country) => void;
  searchPlaceholder: string;
  recentLabel: string;
  allCountriesLabel: string;
  noResultsLabel: string;
}) {
  const rows = useMemo<SheetRow[]>(() => {
    const q = props.query.trim().toLowerCase();
    // Matching the dial code has to work with or without the '+' the user types.
    const digits = q.replace(/\D/g, '');
    const matches = (c: Country) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.iso2.toLowerCase() === q ||
      (!!digits && c.dialCode.startsWith(digits));

    const found = COUNTRIES.filter(matches);
    if (!found.length) return [];

    // Searching means you know what you want — a pinned section on top would
    // just push the answer down the list.
    if (q) return found.map((country) => ({ kind: 'country', country }) as SheetRow);

    const pinnedIso2 = [
      // Malaysia first, always: it is where nearly every rider is.
      'MY',
      ...(props.recentCountries ?? []).filter((i) => i !== 'MY'),
    ];
    const pinned = pinnedIso2
      .map((i) => COUNTRY_BY_ISO2[i])
      .filter((c): c is Country => !!c)
      .slice(0, 6);
    const pinnedSet = new Set(pinned.map((c) => c.iso2));

    return [
      { kind: 'header', title: props.recentLabel },
      ...pinned.map((country) => ({ kind: 'country', country }) as SheetRow),
      { kind: 'header', title: props.allCountriesLabel },
      ...found
        .filter((c) => !pinnedSet.has(c.iso2))
        .map((country) => ({ kind: 'country', country }) as SheetRow),
    ];
  }, [props.query, props.recentCountries, props.recentLabel, props.allCountriesLabel]);

  return (
    <View className="h-[70vh]">
      <Input
        value={props.query}
        onChangeText={props.onQueryChange}
        placeholder={props.searchPlaceholder}
        leadingIcon="search"
        autoCorrect={false}
        autoCapitalize="none"
        className="mb-3"
      />
      {rows.length ? (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => (r.kind === 'header' ? `h-${r.title}-${i}` : r.country.iso2)}
          keyboardShouldPersistTaps="handled"
          // 245 rows: without this the sheet janks on the first open.
          initialNumToRender={14}
          windowSize={7}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Text weight="medium" tone="secondary" className="px-1 pb-1 pt-3 text-xs uppercase">
                {item.title}
              </Text>
            ) : (
              <CountryRow
                country={item.country}
                selected={item.country.iso2 === props.selectedIso2}
                onPress={() => props.onPick(item.country)}
              />
            )
          }
        />
      ) : (
        <Text tone="secondary" className="px-1 py-6 text-center text-sm">
          {props.noResultsLabel}
        </Text>
      )}
    </View>
  );
}

function CountryRow({
  country,
  selected,
  onPress,
}: {
  country: Country;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${country.name}, plus ${country.dialCode}`}
      className={cn(
        'h-14 flex-row items-center rounded-lg px-2',
        selected ? 'bg-muted' : undefined,
      )}
    >
      <Text className="w-8 text-lg">{country.flag}</Text>
      <Text className="flex-1 text-base text-ink-primary" numberOfLines={1}>
        {country.name}
      </Text>
      <Text tone="secondary" className="ml-3 text-base">
        +{country.dialCode}
      </Text>
      {selected ? (
        <Icon name="check" size={18} color="#16A34A" className="ml-2" />
      ) : (
        <View className="ml-2 w-[18px]" />
      )}
    </Pressable>
  );
}
