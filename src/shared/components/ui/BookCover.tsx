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
      className={`relative isolate w-full overflow-hidden rounded-[24px] ${ratioClassName} ${className}`}
      style={{
        border: "1px solid color-mix(in srgb, var(--c-border) 58%, transparent)",
        backgroundColor:
          "color-mix(in srgb, var(--c-surface-elevated) 95%, var(--c-surface))",
        boxShadow: "0 18px 40px color-mix(in srgb, #2b1f14 9%, transparent)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 14% 10%, color-mix(in srgb, var(--c-accent-soft) 45%, transparent), transparent 54%)",
        }}
      />

      {showImage ? (
        <div className="relative z-[1] flex h-full w-full items-center justify-center p-2.5">
          <img
            src={src ?? undefined}
            alt={title}
            loading="lazy"
            className={`h-full w-full rounded-[18px] ${fitClass}`}
            style={
              framed
                ? {
                    backgroundColor: "color-mix(in srgb, var(--c-surface) 88%, transparent)",
                    boxShadow:
                      "0 1px 0 color-mix(in srgb, var(--c-border) 26%, transparent) inset",
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
