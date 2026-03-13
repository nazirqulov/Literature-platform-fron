import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../services/api";

type ProfileMap = Record<number, string | null | undefined>;

const useAuthorProfileImages = (authorIds: number[]) => {
  const [profilesById, setProfilesById] = useState<ProfileMap>({});
  const objectUrlsRef = useRef<Map<number, string>>(new Map());

  const fetchProfileForAuthor = useCallback(async (authorId: number) => {
    if (Number.isNaN(authorId)) return;
    setProfilesById((prev) => {
      if (authorId in prev) return prev;
      return { ...prev, [authorId]: undefined };
    });

    try {
      const response = await api.get<Blob>(
        `/api/authors/author-profileImage/${authorId}`,
        { responseType: "blob" },
      );
      if (!response.data || response.data.size === 0) {
        setProfilesById((prev) => ({ ...prev, [authorId]: null }));
        return;
      }

      const objectUrl = URL.createObjectURL(response.data);
      const existing = objectUrlsRef.current.get(authorId);
      if (existing) {
        URL.revokeObjectURL(existing);
      }
      objectUrlsRef.current.set(authorId, objectUrl);
      setProfilesById((prev) => ({ ...prev, [authorId]: objectUrl }));
    } catch {
      setProfilesById((prev) => ({ ...prev, [authorId]: null }));
    }
  }, []);

  useEffect(() => {
    const idSet = new Set(authorIds);
    objectUrlsRef.current.forEach((url, id) => {
      if (!idSet.has(id)) {
        URL.revokeObjectURL(url);
        objectUrlsRef.current.delete(id);
        setProfilesById((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });

    authorIds.forEach((id) => {
      if (!(id in profilesById)) {
        void fetchProfileForAuthor(id);
      }
    });
  }, [authorIds, fetchProfileForAuthor, profilesById]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  return profilesById;
};

export default useAuthorProfileImages;
