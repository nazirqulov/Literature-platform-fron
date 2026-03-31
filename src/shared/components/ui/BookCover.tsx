import React, { useEffect, useMemo, useState } from "react";
import EmptyCoverPlaceholder from "./EmptyCoverPlaceholder";

type BookCoverProps = {
  title: string;
  src?: string | null;
  loading?: boolean;
  className?: string;
  ratioClassName?: string;
  fit?: "contain" | "cover";
  framed?: boolean;
};

const BookCover: React.FC<BookCoverProps> = ({
  title,
  src,
  loading = false,
  className = "",
  ratioClassName = "aspect-[3/4]",
  fit = "contain",
  framed = true,
}) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const showImage = Boolean(src) && !hasError;
  const fitClass = useMemo(
    () => (fit === "cover" ? "object-cover" : "object-contain"),
    [fit],
  );

  return (
    <div
      className={`relative isolate w-full overflow-hidden rounded-2xl border ${ratioClassName} ${className}`}
      style={{
        borderColor: "color-mix(in srgb, var(--c-border) 86%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--c-surface) 90%, transparent)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--c-accent-soft) 45%, transparent), transparent 55%)",
        }}
      />

      {showImage ? (
        <div className="relative z-[1] flex h-full w-full items-center justify-center p-3">
          <img
            src={src ?? undefined}
            alt={title}
            loading="lazy"
            className={`h-full w-full rounded-xl ${fitClass}`}
            style={
              framed
                ? {
                    border: "1px solid color-mix(in srgb, var(--c-border) 58%, transparent)",
                  }
                : undefined
            }
            onLoad={() => setHasError(false)}
            onError={() => setHasError(true)}
          />
        </div>
      ) : (
        <EmptyCoverPlaceholder
          loading={loading}
          error={!loading && hasError}
          title={title}
          className="relative z-[1]"
        />
      )}
    </div>
  );
};

export default BookCover;
