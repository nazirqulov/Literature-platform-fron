import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Pencil, Plus, X } from "lucide-react";
import api from "../../services/api";
import type { AxiosError } from "axios";
import { pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const MAX_AUDIO_SIZE = 100 * 1024 * 1024;

const AdminBooksPage: React.FC = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [authors, setAuthors] = useState<AuthorResponse[]>([]);
  const [books, setBooks] = useState<BookResponse[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [bookCovers, setBookCovers] = useState<
    Record<number, string | null | undefined>
  >({});
  const [booksPage, setBooksPage] = useState(0);
  const [booksSize, setBooksSize] = useState(10);
  const [booksTotalPages, setBooksTotalPages] = useState(1);
  const [categoryDetailBook, setCategoryDetailBook] =
    useState<BookResponse | null>(null);
  const [newBook, setNewBook] = useState<BookCreateForm>({
    title: "",
    description: "",
    authorId: "",
    subCategoryIds: [],
    manualSubCategoryIds: "",
    isbn: "",
    publishedYear: "",
    publisher: "",
    language: "",
    pageCount: "",
    isFeatured: false,
  });
  const [editingBook, setEditingBook] = useState<BookEditForm | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState<string | null>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [newPdfFile, setNewPdfFile] = useState<File | null>(null);
  const [editPdfFile, setEditPdfFile] = useState<File | null>(null);
  const [newAudioFile, setNewAudioFile] = useState<File | null>(null);
  const [editAudioFile, setEditAudioFile] = useState<File | null>(null);
  const [newAudioPreview, setNewAudioPreview] = useState<string | null>(null);
  const [editAudioPreview, setEditAudioPreview] = useState<string | null>(null);
  const [newCoverProgress, setNewCoverProgress] = useState<number | null>(null);
  const [editCoverProgress, setEditCoverProgress] = useState<number | null>(null);
  const [newPdfProgress, setNewPdfProgress] = useState<number | null>(null);
  const [editPdfProgress, setEditPdfProgress] = useState<number | null>(null);
  const [newAudioProgress, setNewAudioProgress] = useState<number | null>(null);
  const [editAudioProgress, setEditAudioProgress] = useState<number | null>(null);
  const newCoverObjectUrlRef = useRef<string | null>(null);
  const editCoverObjectUrlRef = useRef<string | null>(null);
  const newAudioObjectUrlRef = useRef<string | null>(null);
  const editAudioObjectUrlRef = useRef<string | null>(null);
  const coverObjectUrlsRef = useRef<Map<number, string>>(new Map());

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await api.get<CategoryListResponse>(
        "/api/categories/read",
        {
          params: { page: 0, size: 200 },
        },
      );
      setCategories(Array.isArray(data.content) ? data.content : []);
    } catch {
      toast.error("Categorylar ro'yxatini yuklashda xatolik yuz berdi.");
    }
  }, []);

  const fetchAuthors = useCallback(async () => {
    try {
      const { data } = await api.get<AuthorListResponse>("/api/authors/get-all");
      if (Array.isArray(data)) {
        setAuthors(data as AuthorResponse[]);
      } else if (Array.isArray(data.content)) {
        setAuthors(data.content);
      } else {
        setAuthors([]);
      }
    } catch {
      toast.error("Mualliflar ro'yxatini yuklashda xatolik yuz berdi.");
    }
  }, []);

  const getErrorMessage = (error: unknown, fallback: string) => {
    const axiosError = error as AxiosError;
    const data = axiosError.response?.data as
      | { message?: string; errors?: Record<string, string> }
      | string
      | undefined;

    if (!data) return fallback;
    if (typeof data === "string") return data;
    if (typeof data.message === "string") return data.message;
    if (data.errors && typeof data.errors === "object") {
      return Object.values(data.errors).join(" ");
    }
    return fallback;
  };

  const resolveCoverUrl = (value?: string | null) => {
    if (!value) return null;
    if (value.startsWith("http")) return value;
    const baseUrl = api.defaults.baseURL ?? "http://localhost:8080";
    return new URL(value.replace(/^\/+/, ""), `${baseUrl}/`).toString();
  };

  const clearNewCoverPreview = () => {
    if (newCoverObjectUrlRef.current) {
      URL.revokeObjectURL(newCoverObjectUrlRef.current);
      newCoverObjectUrlRef.current = null;
    }
    setNewCoverPreview(null);
    setNewCoverFile(null);
  };

  const clearEditCoverPreview = () => {
    if (editCoverObjectUrlRef.current) {
      URL.revokeObjectURL(editCoverObjectUrlRef.current);
      editCoverObjectUrlRef.current = null;
    }
    setEditCoverPreview(null);
    setEditCoverFile(null);
  };

  const clearNewPdfFile = () => {
    setNewPdfFile(null);
  };

  const clearEditPdfFile = () => {
    setEditPdfFile(null);
  };

  const clearNewAudioFile = () => {
    if (newAudioObjectUrlRef.current) {
      URL.revokeObjectURL(newAudioObjectUrlRef.current);
      newAudioObjectUrlRef.current = null;
    }
    setNewAudioProgress(null);
    setNewAudioPreview(null);
    setNewAudioFile(null);
  };

  const clearEditAudioFile = () => {
    if (editAudioObjectUrlRef.current) {
      URL.revokeObjectURL(editAudioObjectUrlRef.current);
      editAudioObjectUrlRef.current = null;
    }
    setEditAudioProgress(null);
    setEditAudioPreview(null);
    setEditAudioFile(null);
  };

  const handleCoverSelect = (file: File, mode: "create" | "edit") => {
    if (!file.type.startsWith("image/")) {
      toast.error("Faqat rasm fayllarini yuklash mumkin.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Rasm hajmi 5MB dan oshmasligi kerak.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    if (mode === "create") {
      setNewCoverProgress(null);
      if (newCoverObjectUrlRef.current) {
        URL.revokeObjectURL(newCoverObjectUrlRef.current);
      }
      newCoverObjectUrlRef.current = objectUrl;
      setNewCoverFile(file);
      setNewCoverPreview(objectUrl);
      return;
    }

    setEditCoverProgress(null);
    if (editCoverObjectUrlRef.current) {
      URL.revokeObjectURL(editCoverObjectUrlRef.current);
    }
    editCoverObjectUrlRef.current = objectUrl;
    setEditCoverFile(file);
    setEditCoverPreview(objectUrl);
  };

  const uploadCoverImage = async (
    bookId: number,
    file: File,
    onProgress?: (progress: number) => void,
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    await api.post(`/api/books/${bookId}/cover`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!event.total) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress?.(progress);
      },
    });
  };

  const uploadPdfFile = async (
    bookId: number,
    file: File,
    pageCount: number,
    onProgress?: (progress: number) => void,
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("pageCount", String(pageCount));
    await api.post(`/api/books/file/pdf/${bookId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!event.total) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress?.(progress);
      },
    });
  };

  const uploadAudioFile = async (
    bookId: number,
    file: File,
    onProgress?: (progress: number) => void,
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    await api.post(`/api/books/file/audio/${bookId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!event.total) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress?.(progress);
      },
    });
  };

  const handlePdfSelect = async (file: File, mode: "create" | "edit") => {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Faqat PDF fayl yuklash mumkin.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("PDF hajmi 50MB dan oshmasligi kerak.");
      return;
    }

    const readPageCount = async () => {
      try {
        const data = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data });
        const pdf = await loadingTask.promise;
        const pages = pdf.numPages;
        await pdf.destroy();
        return pages;
      } catch {
        return null;
      }
    };

    if (mode === "create") {
      setNewPdfProgress(null);
      setNewPdfFile(file);
      const pages = await readPageCount();
      if (pages) {
        setNewBook((prev) => ({ ...prev, pageCount: String(pages) }));
      } else {
        toast.error("PDF sahifa sonini aniqlab bo'lmadi.");
      }
      return;
    }

    setEditPdfProgress(null);
    setEditPdfFile(file);
    const pages = await readPageCount();
    if (pages) {
      setEditingBook((prev) => (prev ? { ...prev, pageCount: String(pages) } : prev));
    } else {
      toast.error("PDF sahifa sonini aniqlab bo'lmadi.");
    }
  };

  const handleAudioSelect = (file: File, mode: "create" | "edit") => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Faqat audio fayl yuklash mumkin.");
      return;
    }
    if (file.size > MAX_AUDIO_SIZE) {
      toast.error("Audio hajmi 100MB dan oshmasligi kerak.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    if (mode === "create") {
      setNewAudioProgress(null);
      if (newAudioObjectUrlRef.current) {
        URL.revokeObjectURL(newAudioObjectUrlRef.current);
      }
      newAudioObjectUrlRef.current = objectUrl;
      setNewAudioFile(file);
      setNewAudioPreview(objectUrl);
      return;
    }

    setEditAudioProgress(null);
    if (editAudioObjectUrlRef.current) {
      URL.revokeObjectURL(editAudioObjectUrlRef.current);
    }
    editAudioObjectUrlRef.current = objectUrl;
    setEditAudioFile(file);
    setEditAudioPreview(objectUrl);
  };

  const setCoverFromFile = (bookId: number, file: File) => {
    const existing = coverObjectUrlsRef.current.get(bookId);
    if (existing) {
      URL.revokeObjectURL(existing);
    }
    const objectUrl = URL.createObjectURL(file);
    coverObjectUrlsRef.current.set(bookId, objectUrl);
    setBookCovers((prev) => ({ ...prev, [bookId]: objectUrl }));
  };

  const fetchCoverForBook = useCallback(
    async (bookId: number) => {
      if (Number.isNaN(bookId)) return;
      setBookCovers((prev) => {
        if (bookId in prev) return prev;
        return { ...prev, [bookId]: undefined };
      });

      try {
        const response = await api.get<Blob>(`/api/books/book-image/${bookId}`, {
          responseType: "blob",
        });
        if (!response.data || response.data.size === 0) {
          setBookCovers((prev) => ({ ...prev, [bookId]: null }));
          return;
        }

        const objectUrl = URL.createObjectURL(response.data);
        coverObjectUrlsRef.current.set(bookId, objectUrl);
        setBookCovers((prev) => ({ ...prev, [bookId]: objectUrl }));
      } catch (error) {
        setBookCovers((prev) => ({ ...prev, [bookId]: null }));
      }
    },
    [setBookCovers],
  );

  const normalizeBooks = (data: unknown) => {
    if (Array.isArray(data)) {
      return {
        items: data as BookResponse[],
        totalPages: 1,
        page: 0,
        size: data.length,
      };
    }

    const pageData = data as PagedResponse<BookResponse>;
    if (Array.isArray(pageData?.content)) {
      return {
        items: pageData.content,
        totalPages: pageData.totalPages ?? 1,
        page: pageData.number ?? 0,
        size: pageData.size ?? pageData.content.length,
      };
    }

    return { items: [], totalPages: 1, page: 0, size: 10 };
  };

  const fetchBooks = useCallback(async () => {
    setBooksLoading(true);
    try {
      const { data } = await api.get("/api/books/get-all", {
        params: { page: booksPage, size: booksSize },
      });
      const normalized = normalizeBooks(data);
      setBooks(normalized.items);
      setBooksTotalPages(normalized.totalPages);
    } catch {
      toast.error("Kitoblar ro'yxatini yuklashda xatolik yuz berdi.");
    } finally {
      setBooksLoading(false);
    }
  }, [booksPage, booksSize]);

  useEffect(() => {
    void fetchCategories();
    void fetchAuthors();
  }, [fetchCategories, fetchAuthors]);

  useEffect(() => {
    void fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    const ids = books.map((book) => book.id).filter((id): id is number => !!id);
    const idSet = new Set(ids);

    // Cleanup object URLs for books not in current list
    coverObjectUrlsRef.current.forEach((url, id) => {
      if (!idSet.has(id)) {
        URL.revokeObjectURL(url);
        coverObjectUrlsRef.current.delete(id);
        setBookCovers((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });

    ids.forEach((id) => {
      if (!(id in bookCovers)) {
        void fetchCoverForBook(id);
      }
    });
  }, [books, bookCovers, fetchCoverForBook]);

  useEffect(() => {
    return () => {
      if (newCoverObjectUrlRef.current) {
        URL.revokeObjectURL(newCoverObjectUrlRef.current);
        newCoverObjectUrlRef.current = null;
      }
      if (editCoverObjectUrlRef.current) {
        URL.revokeObjectURL(editCoverObjectUrlRef.current);
        editCoverObjectUrlRef.current = null;
      }
      if (newAudioObjectUrlRef.current) {
        URL.revokeObjectURL(newAudioObjectUrlRef.current);
        newAudioObjectUrlRef.current = null;
      }
      if (editAudioObjectUrlRef.current) {
        URL.revokeObjectURL(editAudioObjectUrlRef.current);
        editAudioObjectUrlRef.current = null;
      }
      coverObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      coverObjectUrlsRef.current.clear();
    };
  }, []);

  const resolveSubCategoryId = (child: CategoryChild) =>
    child.id ??
    child.subCategoryId ??
    child.subcategoryId ??
    child.categoryId ??
    null;

  const subCategoryGroups = useMemo(() => {
    return categories.map((category) => ({
      parentName: category.name,
      children: (category.children ?? []).map((child) => ({
        id: resolveSubCategoryId(child),
        name: child.name,
      })),
    }));
  }, [categories]);

  const subCategoryIdByName = useMemo(() => {
    const map = new Map<string, number>();
    subCategoryGroups.forEach((group) => {
      group.children.forEach((child) => {
        if (child.id != null) {
          map.set(child.name, child.id);
        }
      });
    });
    return map;
  }, [subCategoryGroups]);

  const categoryChildrenByName = useMemo(() => {
    const map = new Map<string, string[]>();
    categories.forEach((category) => {
      const children = (category.children ?? [])
        .map((child) => child.name)
        .filter((name): name is string => !!name);
      map.set(category.name, children);
    });
    return map;
  }, [categories]);

  const flattenedSubCategories = useMemo(() => {
    return subCategoryGroups.flatMap((group) =>
      group.children.filter((child) => child.id != null),
    );
  }, [subCategoryGroups]);

  const hasSelectableSubCategories = flattenedSubCategories.length > 0;

  const resetForm = () => {
    setNewBook({
      title: "",
      description: "",
      authorId: "",
      subCategoryIds: [],
      manualSubCategoryIds: "",
      isbn: "",
      publishedYear: "",
      publisher: "",
      language: "",
      pageCount: "",
      isFeatured: false,
    });
    clearNewCoverPreview();
    clearNewPdfFile();
    clearNewAudioFile();
  };

  const openEditModal = (book: BookResponse) => {
    const initialSubCategoryIds = Array.isArray(book.subCategoryName)
      ? book.subCategoryName
          .map((name) => subCategoryIdByName.get(name))
          .filter((id): id is number => typeof id === "number")
      : [];
    setEditingBook({
      id: book.id ?? 0,
      title: book.title ?? "",
      description: book.description ?? "",
      authorId: book.author?.id ? String(book.author.id) : "",
      subCategoryIds: initialSubCategoryIds,
      manualSubCategoryIds: "",
      isbn: book.isbn ?? "",
      publishedYear: book.publishedYear ? String(book.publishedYear) : "",
      publisher: book.publisher ?? "",
      language: book.language ?? "",
      pageCount: book.pageCount ? String(book.pageCount) : "",
      isFeatured: Boolean(book.isFeatured),
    });
    clearEditCoverPreview();
    const existingCover = resolveCoverUrl(book.coverImage);
    if (existingCover) {
      setEditCoverPreview(existingCover);
    }
    clearEditPdfFile();
    clearEditAudioFile();
  };

  const closeEditModal = () => {
    setEditingBook(null);
    clearEditCoverPreview();
    clearEditPdfFile();
    clearEditAudioFile();
  };

  const toggleEditSubCategoryId = (id: number) => {
    if (!editingBook) return;
    setEditingBook((prev) =>
      prev
        ? {
            ...prev,
            subCategoryIds: prev.subCategoryIds.includes(id)
              ? prev.subCategoryIds.filter((item) => item !== id)
              : [...prev.subCategoryIds, id],
          }
        : prev,
    );
  };

  const updateBook = async () => {
    if (!editingBook) return;
    if (!editingBook.title.trim()) {
      toast.error("Kitob nomi majburiy.");
      return;
    }
    if (!editingBook.authorId.trim()) {
      toast.error("Muallif ID majburiy.");
      return;
    }

    const manualIds = parseManualSubCategoryIds(editingBook.manualSubCategoryIds);
    const mergedSubCategoryIds = Array.from(
      new Set([...editingBook.subCategoryIds, ...manualIds]),
    );

    const resolvedEditPageCount = editPdfFile
      ? await resolvePdfPageCount(editPdfFile, editingBook.pageCount)
      : parsePageCount(editingBook.pageCount);

    if (editPdfFile && !resolvedEditPageCount) {
      toast.error("PDF sahifa sonini aniqlab bo'lmadi.");
      return;
    }

    const payload: BookCreateRequest = {
      title: editingBook.title.trim(),
      description: editingBook.description.trim() || undefined,
      authorId: Number(editingBook.authorId),
      subCategoryIds: mergedSubCategoryIds.length
        ? mergedSubCategoryIds
        : undefined,
      isbn: editingBook.isbn.trim() || undefined,
      publishedYear: editingBook.publishedYear
        ? Number(editingBook.publishedYear)
        : undefined,
      publisher: editingBook.publisher.trim() || undefined,
      language: editingBook.language.trim() || undefined,
      pageCount: resolvedEditPageCount ?? undefined,
      isFeatured: editingBook.isFeatured,
    };

    if (Number.isNaN(payload.authorId)) {
      toast.error("Muallif ID noto'g'ri formatda.");
      return;
    }

    setIsUpdating(true);
    try {
      await api.put(`/api/books/update/${editingBook.id}`, payload);
      if (editCoverFile) {
        try {
          setEditCoverProgress(0);
          await uploadCoverImage(
            editingBook.id,
            editCoverFile,
            setEditCoverProgress,
          );
          setCoverFromFile(editingBook.id, editCoverFile);
          setEditCoverProgress(100);
        } catch (uploadError) {
          toast.error(
            getErrorMessage(
              uploadError,
              "Muqova rasmini yuklashda xatolik yuz berdi.",
            ),
          );
          setEditCoverProgress(null);
        }
      }
      if (editPdfFile) {
        try {
          if (resolvedEditPageCount) {
            setEditingBook((prev) =>
              prev ? { ...prev, pageCount: String(resolvedEditPageCount) } : prev,
            );
            setEditPdfProgress(0);
            await uploadPdfFile(
              editingBook.id,
              editPdfFile,
              resolvedEditPageCount,
              setEditPdfProgress,
            );
            setEditPdfProgress(100);
          }
        } catch (uploadError) {
          toast.error(
            getErrorMessage(
              uploadError,
              "PDF faylni yuklashda xatolik yuz berdi.",
            ),
          );
          setEditPdfProgress(null);
        }
      }
      if (editAudioFile) {
        try {
          setEditAudioProgress(0);
          await uploadAudioFile(
            editingBook.id,
            editAudioFile,
            setEditAudioProgress,
          );
          setEditAudioProgress(100);
        } catch (uploadError) {
          toast.error(
            getErrorMessage(
              uploadError,
              "Audio faylni yuklashda xatolik yuz berdi.",
            ),
          );
          setEditAudioProgress(null);
        }
      }
      toast.success("Kitob ma'lumotlari yangilandi.");
      await fetchBooks();
      closeEditModal();
    } catch (error) {
      toast.error(getErrorMessage(error, "Yangilashda xatolik yuz berdi."));
    } finally {
      setIsUpdating(false);
    }
  };

  const openCreateModal = () => {
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    resetForm();
  };

  const toggleSubCategoryId = (id: number) => {
    setNewBook((prev) => ({
      ...prev,
      subCategoryIds: prev.subCategoryIds.includes(id)
        ? prev.subCategoryIds.filter((item) => item !== id)
        : [...prev.subCategoryIds, id],
    }));
  };

  const parseManualSubCategoryIds = (value: string) =>
    value
      .split(/[, ]+/)
      .map((item) => Number(item.trim()))
      .filter((num) => !Number.isNaN(num) && num > 0);

  const parsePageCount = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const normalized = Math.floor(parsed);
    return normalized > 0 ? normalized : null;
  };

  const resolvePdfPageCount = async (file: File, value: string) => {
    const existing = parsePageCount(value);
    if (existing) return existing;

    try {
      const data = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data });
      const pdf = await loadingTask.promise;
      const pages = pdf.numPages;
      await pdf.destroy();
      return pages;
    } catch {
      return null;
    }
  };

  const createBook = async () => {
    if (!newBook.title.trim()) {
      toast.error("Kitob nomi majburiy.");
      return;
    }
    if (!newBook.authorId.trim()) {
      toast.error("Muallif ID majburiy.");
      return;
    }

    const manualIds = parseManualSubCategoryIds(newBook.manualSubCategoryIds);
    const mergedSubCategoryIds = Array.from(
      new Set([...newBook.subCategoryIds, ...manualIds]),
    );

    const resolvedNewPageCount = newPdfFile
      ? await resolvePdfPageCount(newPdfFile, newBook.pageCount)
      : parsePageCount(newBook.pageCount);

    if (newPdfFile && !resolvedNewPageCount) {
      toast.error("PDF sahifa sonini aniqlab bo'lmadi.");
      return;
    }

    const payload: BookCreateRequest = {
      title: newBook.title.trim(),
      description: newBook.description.trim() || undefined,
      authorId: Number(newBook.authorId),
      subCategoryIds: mergedSubCategoryIds.length
        ? mergedSubCategoryIds
        : undefined,
      isbn: newBook.isbn.trim() || undefined,
      publishedYear: newBook.publishedYear
        ? Number(newBook.publishedYear)
        : undefined,
      publisher: newBook.publisher.trim() || undefined,
      language: newBook.language.trim() || undefined,
      pageCount: resolvedNewPageCount ?? undefined,
      isFeatured: newBook.isFeatured,
    };

    if (Number.isNaN(payload.authorId)) {
      toast.error("Muallif ID noto'g'ri formatda.");
      return;
    }

    setIsCreating(true);
    try {
      const { data } = await api.post<BookResponse>("/api/books/create", payload);
      if (newCoverFile && data?.id) {
        try {
          setNewCoverProgress(0);
          await uploadCoverImage(data.id, newCoverFile, setNewCoverProgress);
          setCoverFromFile(data.id, newCoverFile);
          setNewCoverProgress(100);
        } catch (uploadError) {
          toast.error(
            getErrorMessage(
              uploadError,
              "Muqova rasmini yuklashda xatolik yuz berdi.",
            ),
          );
          setNewCoverProgress(null);
        }
      }
      if (newPdfFile && data?.id) {
        try {
          if (resolvedNewPageCount) {
            setNewBook((prev) => ({ ...prev, pageCount: String(resolvedNewPageCount) }));
            setNewPdfProgress(0);
            await uploadPdfFile(
              data.id,
              newPdfFile,
              resolvedNewPageCount,
              setNewPdfProgress,
            );
            setNewPdfProgress(100);
          }
        } catch (uploadError) {
          toast.error(
            getErrorMessage(
              uploadError,
              "PDF faylni yuklashda xatolik yuz berdi.",
            ),
          );
          setNewPdfProgress(null);
        }
      }
      if (newAudioFile && data?.id) {
        try {
          setNewAudioProgress(0);
          await uploadAudioFile(data.id, newAudioFile, setNewAudioProgress);
          setNewAudioProgress(100);
        } catch (uploadError) {
          toast.error(
            getErrorMessage(
              uploadError,
              "Audio faylni yuklashda xatolik yuz berdi.",
            ),
          );
          setNewAudioProgress(null);
        }
      }
      toast.success("Kitob muvaffaqiyatli qo'shildi.");
      await fetchBooks();
      closeCreateModal();
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Kitob qo'shishda xatolik yuz berdi.",
      );
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const formatCell = (value?: string | number | null) => {
    if (value === null || value === undefined || value === "") {
      return "--";
    }
    return value;
  };

  const renderUploadProgress = (progress: number | null) => {
    if (progress === null) return null;
    const isDone = progress >= 100;
    const label = isDone
      ? "Yuklandi"
      : progress === 0
        ? "Yuklanmoqda..."
        : `Yuklanmoqda: ${progress}%`;

    return (
      <div className="mt-2 space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#E3DBCF]/60">
          <div
            className="h-full rounded-full bg-[#6B4F3A] transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-[#6B6B6B]">{label}</p>
      </div>
    );
  };

  const renderCategoryGroups = (book: BookResponse) => {
    const categoryNames = (book.categories ?? [])
      .map((item) => item.name)
      .filter((name): name is string => !!name);
    const subNames = (book.subCategoryName ?? []).filter(
      (name): name is string => !!name,
    );

    if (categoryNames.length === 0 && subNames.length === 0) {
      return <span className="text-[#6B6B6B]">--</span>;
    }

    const used = new Set<string>();

    return (
      <div className="space-y-2">
        {categoryNames.length > 0 ? (
          categoryNames.map((categoryName) => {
            const possibleChildren = categoryChildrenByName.get(categoryName) ?? [];
            const matched = subNames.filter((name) =>
              possibleChildren.includes(name),
            );
            matched.forEach((name) => used.add(name));

            return (
              <div key={categoryName} className="space-y-1">
                <div className="text-xs font-semibold text-[#2B2B2B]">
                  {categoryName}
                </div>
                {matched.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {matched.map((name, index) => (
                      <span
                        key={`${categoryName}-${name}-${index}`}
                        className="rounded-full border border-[#E3DBCF] bg-[#E3DBCF]/60 px-2 py-0.5 text-xs font-semibold text-[#6B6B6B]"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-[#9A9A9A]">
                    Subcategory yo'q
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <span className="text-xs text-[#9A9A9A]">Kategoriya yo'q</span>
        )}

        {subNames.length > 0 && used.size !== subNames.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#2B2B2B]">Boshqa</div>
            <div className="flex flex-wrap gap-1">
              {subNames
                .filter((name) => !used.has(name))
                .map((name, index) => (
                  <span
                    key={`other-${name}-${index}`}
                    className="rounded-full border border-[#E3DBCF] bg-[#E3DBCF]/60 px-2 py-0.5 text-xs font-semibold text-[#6B6B6B]"
                  >
                    {name}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCategorySummary = (book: BookResponse) => {
    const categoryNames = (book.categories ?? [])
      .map((item) => item.name)
      .filter((name): name is string => !!name);
    const subNames = (book.subCategoryName ?? []).filter(
      (name): name is string => !!name,
    );

    if (categoryNames.length === 0 && subNames.length === 0) {
      return <span className="text-[#6B6B6B]">--</span>;
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#E3DBCF] bg-white px-2 py-0.5 text-xs font-semibold text-[#6B6B6B]">
          {categoryNames.length} kategoriya
        </span>
        <span className="rounded-full border border-[#E3DBCF] bg-white px-2 py-0.5 text-xs font-semibold text-[#6B6B6B]">
          {subNames.length} subcategory
        </span>
        {book.id != null && (
          <button
            type="button"
            onClick={() => setCategoryDetailBook(book)}
            className="rounded-full border border-[#6B4F3A]/30 bg-[#6B4F3A]/10 px-3 py-0.5 text-xs font-semibold text-[#6B4F3A] transition hover:bg-[#6B4F3A]/20"
          >
            Ko'rish
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[#2B2B2B]">Kitoblar</h1>
          <p className="text-sm text-[#6B6B6B]">
            Kitoblarni qo'shish va boshqarish.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#6B4F3A] px-4 py-2 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#5A4030] sm:w-auto"
        >
          <Plus size={18} />
          Kitob qo'shish
        </button>
      </div>

      <div className="rounded-2xl bg-[#EFE7DB]/50 p-4">
        <div className="overflow-x-auto rounded-2xl border border-[#E3DBCF]">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#F5F1E8] text-left text-xs uppercase tracking-wide text-[#6B6B6B]">
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">
                  ID
                </th>
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">
                  Kitob nomi
                </th>
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">
                  Muallif
                </th>
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">
                  Kategoriya / Subcategory
                </th>
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">
                  Til
                </th>
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">
                  Nashr yili
                </th>
                <th className="border-b border-[#E3DBCF] px-4 py-4">
                  Tavsiya
                </th>
                <th className="border-b border-[#E3DBCF] px-4 py-4">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DBCF]">
              {booksLoading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-[#6B6B6B]"
                  >
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : books.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-[#6B6B6B]"
                  >
                    Kitoblar topilmadi.
                  </td>
                </tr>
              ) : (
                books.map((book, index) => (
                  <React.Fragment key={book.id ?? `book-${index}`}>
                    <tr className="bg-[#F5F1E8]/40 transition hover:bg-[#EFE7DB]/60">
                      <td className="border-r border-[#E3DBCF] px-4 py-4 text-[#2B2B2B]">
                        {formatCell(book.id)}
                      </td>
                      <td className="border-r border-[#E3DBCF] px-4 py-4 text-[#2B2B2B]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-9 items-center justify-center overflow-hidden rounded-md border border-[#E3DBCF] bg-white">
                            {book.id && bookCovers[book.id] ? (
                              <img
                                src={bookCovers[book.id] ?? ""}
                                alt={book.title ?? "Muqova"}
                                className="h-full w-full object-cover"
                              />
                            ) : book.id && bookCovers[book.id] === null ? (
                              <span className="text-[10px] text-[#9A9A9A]">
                                Rasm yo'q
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#9A9A9A]">
                                Yuklanmoqda...
                              </span>
                            )}
                          </div>
                          <span>{formatCell(book.title)}</span>
                        </div>
                      </td>
                      <td className="border-r border-[#E3DBCF] px-4 py-4 text-[#2B2B2B]">
                        {formatCell(book.author?.name)}
                      </td>
                      <td className="border-r border-[#E3DBCF] px-4 py-4 text-[#2B2B2B]">
                        {renderCategorySummary(book)}
                      </td>
                      <td className="border-r border-[#E3DBCF] px-4 py-4 text-[#2B2B2B]">
                        {formatCell(book.language)}
                      </td>
                      <td className="border-r border-[#E3DBCF] px-4 py-4 text-[#2B2B2B]">
                        {formatCell(book.publishedYear)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            book.isFeatured
                              ? "bg-[#6B4F3A]/15 text-[#6B4F3A]"
                              : "bg-[#E3DBCF]/70 text-[#6B6B6B]",
                          ].join(" ")}
                        >
                          {book.isFeatured ? "Tavsiya" : "Oddiy"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openEditModal(book)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#E3DBCF] px-2 py-1 text-xs text-[#2B2B2B] transition hover:bg-white"
                        >
                          <Pencil size={14} />
                          Tahrirlash
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6B6B6B]">
          <div className="flex items-center gap-2">
            <span>Ko'rsatish:</span>
            <select
              value={booksSize}
              onChange={(event) => {
                setBooksPage(0);
                setBooksSize(Number(event.target.value));
              }}
              className="rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-2 py-1 text-sm text-[#2B2B2B]"
            >
              {[5, 10, 20, 50].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={booksPage <= 0}
              onClick={() => setBooksPage((prev) => Math.max(0, prev - 1))}
              className="rounded-md border border-[#E3DBCF] px-3 py-1 text-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Oldingi
            </button>
            <span>
              Sahifa {booksPage + 1} / {booksTotalPages}
            </span>
            <button
              disabled={booksPage + 1 >= booksTotalPages}
              onClick={() => setBooksPage((prev) => prev + 1)}
              className="rounded-md border border-[#E3DBCF] px-3 py-1 text-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Keyingi
            </button>
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6">
          <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E3DBCF] bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b border-[#E3DBCF] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[#2B2B2B]">
                  Kitob qo'shish
                </h2>
                <p className="text-sm text-[#6B6B6B]">
                  Kitob nomi va muallif ID majburiy.
                </p>
              </div>
              <button
                onClick={closeCreateModal}
                className="self-start rounded-lg border border-[#E3DBCF] px-3 py-1 text-sm text-[#6B6B6B] transition hover:bg-white sm:self-auto"
                aria-label="Modalni yopish"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[75vh] flex-1 overflow-y-auto px-4 py-4 sm:max-h-[70vh] sm:px-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Kitob nomi
                  </label>
                  <input
                    value={newBook.title}
                    onChange={(event) =>
                    setNewBook((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                  placeholder="Masalan: O'tkan kunlar"
                />
              </div>

                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Kitob tavsifi
                  </label>
                  <textarea
                    value={newBook.description}
                    onChange={(event) =>
                    setNewBook((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-[90px] w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                  placeholder="Kitob haqida qisqacha..."
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-medium text-[#6B6B6B]">
                  Muqova rasmi (ixtiyoriy)
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex h-28 w-20 items-center justify-center overflow-hidden rounded-lg border border-[#E3DBCF] bg-white">
                    {newCoverPreview ? (
                      <img
                        src={newCoverPreview}
                        alt="Muqova preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-[#9A9A9A]">Rasm yo'q</span>
                    )}
                  </div>
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-[#E3DBCF] bg-white px-4 py-2 text-sm text-[#6B6B6B] transition hover:bg-[#EFE7DB]/60">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) handleCoverSelect(file, "create");
                      }}
                    />
                    Rasm tanlash
                  </label>
                </div>
                <p className="text-xs text-[#9A9A9A]">
                  JPG/PNG, 5MB gacha.
                </p>
                {renderUploadProgress(newCoverProgress)}
              </div>

              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-medium text-[#6B6B6B]">
                  PDF fayl (ixtiyoriy)
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="rounded-lg border border-[#E3DBCF] bg-white px-4 py-2 text-sm text-[#6B6B6B]">
                    {newPdfFile ? newPdfFile.name : "PDF tanlanmagan"}
                  </div>
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-[#E3DBCF] bg-white px-4 py-2 text-sm text-[#6B6B6B] transition hover:bg-[#EFE7DB]/60">
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                          if (file) void handlePdfSelect(file, "create");
                      }}
                    />
                    PDF tanlash
                  </label>
                  {newPdfFile && (
                    <button
                      type="button"
                      onClick={clearNewPdfFile}
                      className="text-xs font-semibold text-[#6B6B6B] hover:text-[#2B2B2B]"
                    >
                      Bekor qilish
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#9A9A9A]">
                  Faqat PDF, 50MB gacha.
                </p>
                {renderUploadProgress(newPdfProgress)}
              </div>

              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-medium text-[#6B6B6B]">
                  Audio fayl (ixtiyoriy)
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="rounded-lg border border-[#E3DBCF] bg-white px-4 py-2 text-sm text-[#6B6B6B]">
                    {newAudioFile ? newAudioFile.name : "Audio tanlanmagan"}
                  </div>
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-[#E3DBCF] bg-white px-4 py-2 text-sm text-[#6B6B6B] transition hover:bg-[#EFE7DB]/60">
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) handleAudioSelect(file, "create");
                      }}
                    />
                    Audio tanlash
                  </label>
                  {newAudioFile && (
                    <button
                      type="button"
                      onClick={clearNewAudioFile}
                      className="text-xs font-semibold text-[#6B6B6B] hover:text-[#2B2B2B]"
                    >
                      Bekor qilish
                    </button>
                  )}
                </div>
                {newAudioPreview ? (
                  <audio
                    className="mt-2 w-full"
                    controls
                    preload="metadata"
                    src={newAudioPreview}
                  />
                ) : null}
                <p className="text-xs text-[#9A9A9A]">
                  MP3/WAV/OGG, 100MB gacha.
                </p>
                {renderUploadProgress(newAudioProgress)}
              </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Muallif
                  </label>
                  <select
                    value={newBook.authorId}
                    onChange={(event) =>
                    setNewBook((prev) => ({
                      ...prev,
                      authorId: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                >
                  <option value="">Tanlang</option>
                  {authors.map((author) => (
                    <option key={author.id} value={author.id}>
                      {author.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#6B6B6B]">
                  Agar muallif ro'yxati bo'sh bo'lsa, avval muallif qo'shing.
                </p>
              </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    ISBN
                  </label>
                  <input
                    value={newBook.isbn}
                    onChange={(event) =>
                    setNewBook((prev) => ({ ...prev, isbn: event.target.value }))
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                  placeholder="ISBN"
                />
              </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Nashr yili
                  </label>
                  <input
                    value={newBook.publishedYear}
                    onChange={(event) =>
                    setNewBook((prev) => ({
                      ...prev,
                      publishedYear: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                  placeholder="2020"
                />
              </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Nashriyot
                  </label>
                  <input
                    value={newBook.publisher}
                    onChange={(event) =>
                    setNewBook((prev) => ({
                      ...prev,
                      publisher: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                  placeholder="Nashriyot nomi"
                />
              </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Til
                  </label>
                  <input
                    value={newBook.language}
                    onChange={(event) =>
                    setNewBook((prev) => ({
                      ...prev,
                      language: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                  placeholder="O'zbek"
                />
              </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Sahifalar soni
                  </label>
                  <input
                    value={newBook.pageCount}
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-[#E3DBCF] bg-[#EFE7DB]/60 px-3 py-2 text-sm text-[#2B2B2B]"
                    placeholder="PDF yuklanganda avtomatik chiqadi"
                  />
              </div>

                <div className="flex items-center gap-2 lg:col-span-2">
                  <input
                    id="isFeatured"
                    type="checkbox"
                    checked={newBook.isFeatured}
                    onChange={(event) =>
                    setNewBook((prev) => ({
                      ...prev,
                      isFeatured: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-[#E3DBCF]"
                />
                <label htmlFor="isFeatured" className="text-sm text-[#6B6B6B]">
                  Tavsiya etilgan (featured)
                </label>
              </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-semibold text-[#2B2B2B]">
                    Subcategorylar
                  </h3>
                  {!hasSelectableSubCategories && (
                    <span className="text-xs text-[#6B6B6B]">
                      Subcategory ID'lar backenddan berilsa, tanlash osonlashadi.
                    </span>
                  )}
                </div>

                <div className="max-h-60 space-y-4 overflow-auto rounded-xl border border-[#E3DBCF] bg-[#F5F1E8] p-3 sm:max-h-72 sm:p-4">
                  {subCategoryGroups.length === 0 ? (
                    <p className="text-sm text-[#6B6B6B]">
                      Categorylar topilmadi.
                    </p>
                  ) : (
                    subCategoryGroups.map((group) => (
                      <div key={group.parentName} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
                          {group.parentName}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {group.children.length === 0 ? (
                            <p className="text-xs text-[#9A9A9A]">
                              Subcategory yo'q.
                            </p>
                          ) : (
                            group.children.map((child, idx) => (
                              <label
                                key={`${group.parentName}-${child.name}-${idx}`}
                                className="flex items-center gap-2 text-sm text-[#2B2B2B]"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    child.id != null &&
                                    newBook.subCategoryIds.includes(child.id)
                                  }
                                  onChange={() =>
                                    child.id != null &&
                                    toggleSubCategoryId(child.id)
                                  }
                                  disabled={child.id == null}
                                  className="h-4 w-4 rounded border-[#E3DBCF]"
                                />
                                <span className="font-medium">{child.name}</span>
                                {child.id == null && (
                                  <span className="text-xs text-[#9A9A9A]">
                                    (ID yo'q)
                                  </span>
                                )}
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Subcategory ID'lar (ixtiyoriy)
                  </label>
                  <input
                    value={newBook.manualSubCategoryIds}
                    onChange={(event) =>
                      setNewBook((prev) => ({
                        ...prev,
                        manualSubCategoryIds: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                    placeholder="Masalan: 12, 14, 18"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch justify-end gap-3 border-t border-[#E3DBCF] px-4 py-4 sm:flex-row sm:items-center sm:px-6">
              <button
                onClick={closeCreateModal}
                className="rounded-lg border border-[#E3DBCF] px-4 py-2 text-sm text-[#6B6B6B] transition hover:bg-white"
                disabled={isCreating}
              >
                Bekor qilish
              </button>
              <button
                onClick={createBook}
                disabled={isCreating}
                className="rounded-lg bg-[#6B4F3A] px-4 py-2 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#5A4030] disabled:opacity-70"
              >
                {isCreating ? "Yaratilmoqda..." : "Yaratish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6">
          <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E3DBCF] bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b border-[#E3DBCF] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[#2B2B2B]">
                  Kitobni tahrirlash
                </h2>
                <p className="text-sm text-[#6B6B6B]">
                  Kitob nomi va muallif ID majburiy.
                </p>
              </div>
              <button
                onClick={closeEditModal}
                className="self-start rounded-lg border border-[#E3DBCF] px-3 py-1 text-sm text-[#6B6B6B] transition hover:bg-white sm:self-auto"
                aria-label="Modalni yopish"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[75vh] flex-1 overflow-y-auto px-4 py-4 sm:max-h-[70vh] sm:px-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Kitob nomi
                  </label>
                  <input
                    value={editingBook.title}
                    onChange={(event) =>
                      setEditingBook((prev) =>
                        prev ? { ...prev, title: event.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                    placeholder="Masalan: O'tkan kunlar"
                  />
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Kitob tavsifi
                  </label>
                  <textarea
                    value={editingBook.description}
                    onChange={(event) =>
                      setEditingBook((prev) =>
                        prev
                          ? { ...prev, description: event.target.value }
                          : prev,
                      )
                    }
                    className="min-h-[90px] w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                    placeholder="Kitob haqida qisqacha..."
                  />
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Muqova rasmi (ixtiyoriy)
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex h-28 w-20 items-center justify-center overflow-hidden rounded-lg border border-[#E3DBCF] bg-white">
                      {editCoverPreview ? (
                        <img
                          src={editCoverPreview}
                          alt="Muqova preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-[#9A9A9A]">
                          Rasm yo'q
                        </span>
                      )}
                    </div>
                    <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-[#E3DBCF] bg-white px-4 py-2 text-sm text-[#6B6B6B] transition hover:bg-[#EFE7DB]/60">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) handleCoverSelect(file, "edit");
                        }}
                      />
                      Rasm tanlash
                    </label>
                  </div>
                  <p className="text-xs text-[#9A9A9A]">
                    JPG/PNG, 5MB gacha.
                  </p>
                  {renderUploadProgress(editCoverProgress)}
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    PDF fayl (ixtiyoriy)
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="rounded-lg border border-[#E3DBCF] bg-white px-4 py-2 text-sm text-[#6B6B6B]">
                      {editPdfFile
                        ? editPdfFile.name
                        : "PDF tanlanmagan"}
                    </div>
                    <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-[#E3DBCF] bg-white px-4 py-2 text-sm text-[#6B6B6B] transition hover:bg-[#EFE7DB]/60">
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handlePdfSelect(file, "edit");
                        }}
                      />
                      PDF tanlash
                    </label>
                    {editPdfFile && (
                      <button
                        type="button"
                        onClick={clearEditPdfFile}
                        className="text-xs font-semibold text-[#6B6B6B] hover:text-[#2B2B2B]"
                      >
                        Bekor qilish
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#9A9A9A]">
                    Faqat PDF, 50MB gacha.
                  </p>
                  {renderUploadProgress(editPdfProgress)}
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Audio fayl (ixtiyoriy)
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="rounded-lg border border-[#E3DBCF] bg-white px-4 py-2 text-sm text-[#6B6B6B]">
                      {editAudioFile ? editAudioFile.name : "Audio tanlanmagan"}
                    </div>
                    <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-[#E3DBCF] bg-white px-4 py-2 text-sm text-[#6B6B6B] transition hover:bg-[#EFE7DB]/60">
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) handleAudioSelect(file, "edit");
                        }}
                      />
                      Audio tanlash
                    </label>
                    {editAudioFile && (
                      <button
                        type="button"
                        onClick={clearEditAudioFile}
                        className="text-xs font-semibold text-[#6B6B6B] hover:text-[#2B2B2B]"
                      >
                        Bekor qilish
                      </button>
                    )}
                  </div>
                  {editAudioPreview ? (
                    <audio
                      className="mt-2 w-full"
                      controls
                      preload="metadata"
                      src={editAudioPreview}
                    />
                  ) : null}
                  <p className="text-xs text-[#9A9A9A]">
                    MP3/WAV/OGG, 100MB gacha.
                  </p>
                  {renderUploadProgress(editAudioProgress)}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Muallif
                  </label>
                  <select
                    value={editingBook.authorId}
                    onChange={(event) =>
                      setEditingBook((prev) =>
                        prev ? { ...prev, authorId: event.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                  >
                    <option value="">Tanlang</option>
                    {authors.map((author) => (
                      <option key={author.id} value={author.id}>
                        {author.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    ISBN
                  </label>
                  <input
                    value={editingBook.isbn}
                    onChange={(event) =>
                      setEditingBook((prev) =>
                        prev ? { ...prev, isbn: event.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                    placeholder="ISBN"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Nashr yili
                  </label>
                  <input
                    value={editingBook.publishedYear}
                    onChange={(event) =>
                      setEditingBook((prev) =>
                        prev
                          ? { ...prev, publishedYear: event.target.value }
                          : prev,
                      )
                    }
                    className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                    placeholder="2020"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Nashriyot
                  </label>
                  <input
                    value={editingBook.publisher}
                    onChange={(event) =>
                      setEditingBook((prev) =>
                        prev ? { ...prev, publisher: event.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                    placeholder="Nashriyot nomi"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Til
                  </label>
                  <input
                    value={editingBook.language}
                    onChange={(event) =>
                      setEditingBook((prev) =>
                        prev ? { ...prev, language: event.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                    placeholder="O'zbek"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Sahifalar soni
                  </label>
                  <input
                    value={editingBook.pageCount}
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-[#E3DBCF] bg-[#EFE7DB]/60 px-3 py-2 text-sm text-[#2B2B2B]"
                    placeholder="PDF yuklanganda avtomatik chiqadi"
                  />
                </div>

                <div className="flex items-center gap-2 lg:col-span-2">
                  <input
                    id="isFeaturedEdit"
                    type="checkbox"
                    checked={editingBook.isFeatured}
                    onChange={(event) =>
                      setEditingBook((prev) =>
                        prev
                          ? { ...prev, isFeatured: event.target.checked }
                          : prev,
                      )
                    }
                    className="h-4 w-4 rounded border-[#E3DBCF]"
                  />
                  <label htmlFor="isFeaturedEdit" className="text-sm text-[#6B6B6B]">
                    Tavsiya etilgan (featured)
                  </label>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-semibold text-[#2B2B2B]">
                    Subcategorylar
                  </h3>
                  {!hasSelectableSubCategories && (
                    <span className="text-xs text-[#6B6B6B]">
                      Subcategory ID'lar backenddan berilsa, tanlash osonlashadi.
                    </span>
                  )}
                </div>

                <div className="max-h-60 space-y-4 overflow-auto rounded-xl border border-[#E3DBCF] bg-[#F5F1E8] p-3 sm:max-h-72 sm:p-4">
                  {subCategoryGroups.length === 0 ? (
                    <p className="text-sm text-[#6B6B6B]">
                      Categorylar topilmadi.
                    </p>
                  ) : (
                    subCategoryGroups.map((group) => (
                      <div key={group.parentName} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
                          {group.parentName}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {group.children.length === 0 ? (
                            <p className="text-xs text-[#9A9A9A]">
                              Subcategory yo'q.
                            </p>
                          ) : (
                            group.children.map((child, idx) => (
                              <label
                                key={`${group.parentName}-${child.name}-${idx}`}
                                className="flex items-center gap-2 text-sm text-[#2B2B2B]"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    child.id != null &&
                                    editingBook.subCategoryIds.includes(child.id)
                                  }
                                  onChange={() =>
                                    child.id != null &&
                                    toggleEditSubCategoryId(child.id)
                                  }
                                  disabled={child.id == null}
                                  className="h-4 w-4 rounded border-[#E3DBCF]"
                                />
                                <span className="font-medium">{child.name}</span>
                                {child.id == null && (
                                  <span className="text-xs text-[#9A9A9A]">
                                    (ID yo'q)
                                  </span>
                                )}
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#6B6B6B]">
                    Subcategory ID'lar (ixtiyoriy)
                  </label>
                  <input
                    value={editingBook.manualSubCategoryIds}
                    onChange={(event) =>
                      setEditingBook((prev) =>
                        prev
                          ? { ...prev, manualSubCategoryIds: event.target.value }
                          : prev,
                      )
                    }
                    className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                    placeholder="Masalan: 12, 14, 18"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch justify-end gap-3 border-t border-[#E3DBCF] px-4 py-4 sm:flex-row sm:items-center sm:px-6">
              <button
                onClick={closeEditModal}
                className="rounded-lg border border-[#E3DBCF] px-4 py-2 text-sm text-[#6B6B6B] transition hover:bg-white"
                disabled={isUpdating}
              >
                Bekor qilish
              </button>
              <button
                onClick={updateBook}
                disabled={isUpdating}
                className="rounded-lg bg-[#6B4F3A] px-4 py-2 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#5A4030] disabled:opacity-70"
              >
                {isUpdating ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {categoryDetailBook && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E3DBCF] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E3DBCF] px-4 py-3 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[#2B2B2B]">
                  Kategoriya va subcategorylar
                </h2>
                <p className="text-sm text-[#6B6B6B]">
                  {categoryDetailBook.title ?? "Tanlangan kitob"}
                </p>
              </div>
              <button
                onClick={() => setCategoryDetailBook(null)}
                className="rounded-lg border border-[#E3DBCF] px-3 py-1 text-sm text-[#6B6B6B] transition hover:bg-white"
                aria-label="Modalni yopish"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6">
              {renderCategoryGroups(categoryDetailBook)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminBooksPage;

interface BookCreateForm {
  title: string;
  description: string;
  authorId: string;
  subCategoryIds: number[];
  manualSubCategoryIds: string;
  isbn: string;
  publishedYear: string;
  publisher: string;
  language: string;
  pageCount: string;
  isFeatured: boolean;
}

interface BookEditForm extends BookCreateForm {
  id: number;
}

interface BookCreateRequest {
  title: string;
  description?: string;
  authorId: number;
  subCategoryIds?: number[];
  isbn?: string;
  publishedYear?: number;
  publisher?: string;
  language?: string;
  pageCount?: number;
  isFeatured: boolean;
}

interface CategoryChild {
  id?: number | null;
  subCategoryId?: number | null;
  subcategoryId?: number | null;
  categoryId?: number | null;
  name: string;
  description?: string | null;
}

interface CategoryItem {
  id: number;
  name: string;
  children?: CategoryChild[];
}

interface CategoryListResponse {
  content?: CategoryItem[];
}

interface AuthorResponse {
  id: number;
  name: string;
}

interface AuthorListResponse {
  content?: AuthorResponse[];
}

interface BookCategoryResponse {
  id?: number;
  name?: string;
}

interface BookResponse {
  id?: number;
  title?: string;
  description?: string | null;
  author?: AuthorResponse | null;
  categories?: BookCategoryResponse[] | null;
  subCategoryName?: string[] | null;
  isbn?: string | null;
  language?: string | null;
  publishedYear?: number | null;
  publisher?: string | null;
  pageCount?: number | null;
  coverImage?: string | null;
  isFeatured?: boolean | null;
}

interface PagedResponse<T> {
  content?: T[];
  totalPages?: number;
  number?: number;
  size?: number;
}
