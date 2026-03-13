import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import api from "../../services/api";
import { getAuthorInitials, resolveProfileUrl } from "../authors/authorUtils";
import useAuthorProfileImages from "../authors/useAuthorProfileImages";

const AdminAuthorsPage: React.FC = () => {
  const [authors, setAuthors] = useState<AuthorResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState<AuthorResponse | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadingById, setUploadingById] = useState<Record<number, boolean>>({});
  const [newAuthor, setNewAuthor] = useState<AuthorFormState>({
    name: "",
    biography: "",
    birthDate: "",
    deathDate: "",
    nationality: "",
  });

  const fetchAuthors = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAuthors();
  }, [fetchAuthors]);

  const authorIds = useMemo(
    () => authors.map((author) => author.id).filter((id): id is number => !!id),
    [authors],
  );
  const profilesById = useAuthorProfileImages(authorIds);

  const resetForm = () => {
    setNewAuthor({
      name: "",
      biography: "",
      birthDate: "",
      deathDate: "",
      nationality: "",
    });
  };

  const openCreateModal = () => setIsCreateOpen(true);
  const closeCreateModal = () => {
    setIsCreateOpen(false);
    resetForm();
  };

  const startEdit = (author: AuthorResponse) => {
    setEditingAuthor({
      ...author,
      name: author.name ?? "",
      biography: author.biography ?? "",
      birthDate: author.birthDate ?? "",
      deathDate: author.deathDate ?? "",
      nationality: author.nationality ?? "",
    });
  };

  const cancelEdit = () => setEditingAuthor(null);

  const createAuthor = async () => {
    if (!newAuthor.name.trim()) {
      toast.error("Muallif nomi majburiy.");
      return;
    }

    const payload: AuthorRequest = {
      name: newAuthor.name.trim(),
      biography: newAuthor.biography.trim() || undefined,
      birthDate: newAuthor.birthDate || undefined,
      deathDate: newAuthor.deathDate || undefined,
      nationality: newAuthor.nationality.trim() || undefined,
    };

    setIsCreating(true);
    try {
      await api.post("/api/authors/create", payload);
      toast.success("Muallif qo'shildi.");
      closeCreateModal();
      await fetchAuthors();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Muallif qo'shishda xatolik yuz berdi.";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const updateAuthor = async () => {
    if (!editingAuthor) return;
    if (!editingAuthor.name.trim()) {
      toast.error("Muallif nomi majburiy.");
      return;
    }

    const payload: AuthorRequest = {
      name: editingAuthor.name.trim(),
      biography: editingAuthor.biography?.trim() || undefined,
      birthDate: editingAuthor.birthDate || undefined,
      deathDate: editingAuthor.deathDate || undefined,
      nationality: editingAuthor.nationality?.trim() || undefined,
    };

    setIsUpdating(true);
    try {
      await api.put(`/api/authors/update/${editingAuthor.id}`, payload);
      toast.success("Muallif ma'lumotlari yangilandi.");
      setEditingAuthor(null);
      await fetchAuthors();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Yangilashda xatolik yuz berdi.";
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteAuthor = async (author: AuthorResponse) => {
    const confirmed = window.confirm(`${author.name} muallifini o'chirmoqchimisiz?`);
    if (!confirmed) return;

    try {
      await api.delete(`/api/authors/delete/${author.id}`);
      toast.success("Muallif o'chirildi.");
      await fetchAuthors();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "O'chirishda xatolik yuz berdi.";
      toast.error(message);
    }
  };

  const uploadProfileImage = async (authorId: number, file?: File | null) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    setUploadingById((prev) => ({ ...prev, [authorId]: true }));
    try {
      const { data } = await api.post<AuthorResponse>(
        `/api/authors/upload-profile-image/${authorId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      toast.success("Muallif rasmi yangilandi.");
      if (data) {
        setAuthors((prev) =>
          prev.map((author) =>
            author.id === authorId
              ? { ...author, profileImage: data.profileImage ?? author.profileImage }
              : author,
          ),
        );
      }
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Rasm yuklashda xatolik yuz berdi.";
      toast.error(message);
    } finally {
      setUploadingById((prev) => ({ ...prev, [authorId]: false }));
    }
  };

  const totalCount = useMemo(() => authors.length, [authors.length]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[#2B2B2B]">Autorlar</h1>
          <p className="text-sm text-[#6B6B6B]">
            Mualliflar ro'yxati va boshqaruvi.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-[#6B4F3A] px-4 py-2 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#5A4030]"
        >
          <Plus size={18} />
          Muallif qo'shish
        </button>
      </div>

      <div className="rounded-2xl border border-[#E3DBCF] bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-[#6B6B6B]">
          Jami mualliflar
        </p>
        <p className="text-lg font-semibold text-[#2B2B2B]">{totalCount}</p>
      </div>

      <div className="rounded-2xl bg-[#EFE7DB]/50 p-4">
        <div className="overflow-x-auto rounded-2xl border border-[#E3DBCF]">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#F5F1E8] text-left text-xs uppercase tracking-wide text-[#6B6B6B]">
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">ID</th>
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">
                  Ism
                </th>
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">
                  Rasm
                </th>
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">
                  Millat
                </th>
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">
                  Tug'ilgan sana
                </th>
                <th className="border-b border-r border-[#E3DBCF] px-4 py-4">
                  Vafot sanasi
                </th>
                <th className="border-b border-[#E3DBCF] px-4 py-4">
                  Amallar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DBCF]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[#6B6B6B]">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : authors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[#6B6B6B]">
                    Muallif topilmadi.
                  </td>
                </tr>
              ) : (
                authors.map((author) => (
                  <tr
                    key={author.id}
                    className="bg-[#F5F1E8]/40 hover:bg-[#EFE7DB]/60 transition"
                  >
                    <td className="border-r border-[#E3DBCF] px-4 py-4 text-[#2B2B2B]">
                      {author.id ?? "--"}
                    </td>
                    <td className="border-r border-[#E3DBCF] px-4 py-4 text-[#2B2B2B]">
                      {author.name || "--"}
                    </td>
                    <td className="border-r border-[#E3DBCF] px-4 py-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#E3DBCF] bg-white text-xs font-semibold text-[#6B4F3A]">
                          {author.id && profilesById[author.id] ? (
                            <img
                              src={profilesById[author.id] ?? ""}
                              alt={author.name ?? "Muallif"}
                              className="h-full w-full object-cover"
                            />
                          ) : resolveProfileUrl(author.profileImage ?? null) ? (
                            <img
                              src={resolveProfileUrl(author.profileImage ?? null) ?? ""}
                              alt={author.name ?? "Muallif"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{getAuthorInitials(author.name)}</span>
                          )}
                        </div>
                        {author.id ? (
                          <>
                            <label
                              htmlFor={`author-image-${author.id}`}
                              className="inline-flex cursor-pointer items-center rounded-md border border-[#E3DBCF] px-2 py-1 text-xs text-[#2B2B2B] transition hover:bg-white"
                            >
                              {uploadingById[author.id]
                                ? "Yuklanmoqda..."
                                : "Rasm yuklash"}
                            </label>
                            <input
                              id={`author-image-${author.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                void uploadProfileImage(author.id as number, file);
                              }}
                            />
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td className="border-r border-[#E3DBCF] px-4 py-4 text-[#2B2B2B]">
                      {author.nationality || "--"}
                    </td>
                    <td className="border-r border-[#E3DBCF] px-4 py-4 text-[#2B2B2B]">
                      {author.birthDate || "--"}
                    </td>
                    <td className="border-r border-[#E3DBCF] px-4 py-4 text-[#2B2B2B]">
                      {author.deathDate || "--"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(author)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#E3DBCF] px-2 py-1 text-xs text-[#2B2B2B] transition hover:bg-white"
                        >
                          <Pencil size={14} />
                          Tahrirlash
                        </button>
                        <button
                          onClick={() => deleteAuthor(author)}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 px-2 py-1 text-xs text-rose-300 transition hover:bg-rose-500/10"
                        >
                          <Trash2 size={14} />
                          O'chirish
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[#E3DBCF] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#2B2B2B]">
                  Muallif qo'shish
                </h2>
                <p className="text-sm text-[#6B6B6B]">
                  Muallif nomi majburiy.
                </p>
              </div>
              <button
                onClick={closeCreateModal}
                className="rounded-lg border border-[#E3DBCF] px-3 py-1 text-sm text-[#6B6B6B] transition hover:bg-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-[#6B6B6B]">Ism</label>
                <input
                  value={newAuthor.name}
                  onChange={(event) =>
                    setNewAuthor((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-[#6B6B6B]">
                  Biografiya
                </label>
                <textarea
                  value={newAuthor.biography}
                  onChange={(event) =>
                    setNewAuthor((prev) => ({
                      ...prev,
                      biography: event.target.value,
                    }))
                  }
                  className="min-h-[96px] w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#6B6B6B]">
                  Tug'ilgan sana
                </label>
                <input
                  type="date"
                  value={newAuthor.birthDate}
                  onChange={(event) =>
                    setNewAuthor((prev) => ({
                      ...prev,
                      birthDate: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#6B6B6B]">
                  Vafot sanasi
                </label>
                <input
                  type="date"
                  value={newAuthor.deathDate}
                  onChange={(event) =>
                    setNewAuthor((prev) => ({
                      ...prev,
                      deathDate: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-[#6B6B6B]">
                  Millati
                </label>
                <input
                  value={newAuthor.nationality}
                  onChange={(event) =>
                    setNewAuthor((prev) => ({
                      ...prev,
                      nationality: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeCreateModal}
                className="rounded-lg border border-[#E3DBCF] px-4 py-2 text-sm text-[#6B6B6B] transition hover:bg-white"
                disabled={isCreating}
              >
                Bekor qilish
              </button>
              <button
                onClick={createAuthor}
                disabled={isCreating}
                className="rounded-lg bg-[#6B4F3A] px-4 py-2 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#5A4030] disabled:opacity-70"
              >
                {isCreating ? "Yaratilmoqda..." : "Yaratish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAuthor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[#E3DBCF] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#2B2B2B]">
                  Muallifni tahrirlash
                </h2>
              </div>
              <button
                onClick={cancelEdit}
                className="rounded-lg border border-[#E3DBCF] px-3 py-1 text-sm text-[#6B6B6B] transition hover:bg-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-[#6B6B6B]">Ism</label>
                <input
                  value={editingAuthor.name ?? ""}
                  onChange={(event) =>
                    setEditingAuthor((prev) =>
                      prev ? { ...prev, name: event.target.value } : prev,
                    )
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-[#6B6B6B]">
                  Biografiya
                </label>
                <textarea
                  value={editingAuthor.biography ?? ""}
                  onChange={(event) =>
                    setEditingAuthor((prev) =>
                      prev ? { ...prev, biography: event.target.value } : prev,
                    )
                  }
                  className="min-h-[96px] w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#6B6B6B]">
                  Tug'ilgan sana
                </label>
                <input
                  type="date"
                  value={editingAuthor.birthDate ?? ""}
                  onChange={(event) =>
                    setEditingAuthor((prev) =>
                      prev ? { ...prev, birthDate: event.target.value } : prev,
                    )
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#6B6B6B]">
                  Vafot sanasi
                </label>
                <input
                  type="date"
                  value={editingAuthor.deathDate ?? ""}
                  onChange={(event) =>
                    setEditingAuthor((prev) =>
                      prev ? { ...prev, deathDate: event.target.value } : prev,
                    )
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-[#6B6B6B]">
                  Millati
                </label>
                <input
                  value={editingAuthor.nationality ?? ""}
                  onChange={(event) =>
                    setEditingAuthor((prev) =>
                      prev ? { ...prev, nationality: event.target.value } : prev,
                    )
                  }
                  className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B]"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={cancelEdit}
                className="rounded-lg border border-[#E3DBCF] px-4 py-2 text-sm text-[#6B6B6B] transition hover:bg-white"
                disabled={isUpdating}
              >
                Bekor qilish
              </button>
              <button
                onClick={updateAuthor}
                disabled={isUpdating}
                className="rounded-lg bg-[#6B4F3A] px-4 py-2 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#5A4030] disabled:opacity-70"
              >
                {isUpdating ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminAuthorsPage;

interface AuthorRequest {
  name: string;
  biography?: string;
  birthDate?: string;
  deathDate?: string;
  nationality?: string;
}

interface AuthorFormState {
  name: string;
  biography: string;
  birthDate: string;
  deathDate: string;
  nationality: string;
}

interface AuthorResponse extends AuthorRequest {
  id: number;
  profileImage?: string;
}

interface AuthorListResponse {
  content?: AuthorResponse[];
}


