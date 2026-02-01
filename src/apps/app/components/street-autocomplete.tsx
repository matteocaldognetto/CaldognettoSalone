import { Input } from "@repo/ui";
import { Search, AlertCircle } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";

export interface StreetSuggestion {
  name: string;
  lat: number;
  lon: number;
  displayName: string;
  type?: string;
}

interface StreetAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: StreetSuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

export function StreetAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Search for a street...",
  disabled = false,
  error,
}: StreetAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<StreetSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const justSelectedRef = useRef(false);

  // Fetch suggestions from Photon API (better for search/autocomplete)
  const fetchSuggestions = useCallback(
    async (searchText: string) => {
      if (!searchText.trim() || searchText.length < 2) {
        setSuggestions([]);
        return;
      }

      // Don't reopen dropdown if we just selected an item
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }

      setIsLoading(true);
      try {
        // Use Photon API - specifically designed for search on OSM data
        // bbox for Milan: [lon_min, lat_min, lon_max, lat_max]
        // Milan: 9.0976, 45.3568, 9.2767, 45.5155
        const response = await fetch(
          `https://photon.komoot.io/api?q=${encodeURIComponent(
            searchText,
          )}&limit=7&osm_tag=highway&bbox=9.0976,45.3568,9.2767,45.5155`,
        );

        if (!response.ok) throw new Error("Failed to fetch suggestions");

        const data = await response.json();
        const filtered = (data.features || [])
          .filter(
            (item: any) =>
              item.properties?.type === "street" ||
              item.properties?.type === "road" ||
              item.properties?.type === "residential",
          )
          .map((item: any) => ({
            name: item.properties?.name || item.properties?.street,
            lat: item.geometry.coordinates[1],
            lon: item.geometry.coordinates[0],
            displayName: item.properties?.name || "Unknown",
            type: item.properties?.type,
          }))
          .slice(0, 5);

        setSuggestions(filtered);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, fetchSuggestions]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (suggestion: StreetSuggestion) => {
    justSelectedRef.current = true;
    onChange(suggestion.name);
    onSelect(suggestion);
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.trim().length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={error ? "border-red-500" : ""}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
          style={{ zIndex: 9999 }}
        >
          {suggestions.map((suggestion, idx) => (
            <button
              key={`${suggestion.lat}-${suggestion.lon}`}
              onClick={() => handleSelect(suggestion)}
              className={`w-full text-left px-4 py-2 border-b last:border-0 transition-colors ${
                idx === selectedIndex
                  ? "bg-blue-100 hover:bg-blue-100"
                  : "hover:bg-gray-50"
              }`}
            >
              <p className="font-medium text-sm">{suggestion.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {suggestion.displayName.split(",").slice(-2).join(", ")}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen &&
        !isLoading &&
        value.trim().length >= 2 &&
        suggestions.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg p-3 text-sm text-gray-500 text-center">
            No streets found. Try another search.
          </div>
        )}
    </div>
  );
}
