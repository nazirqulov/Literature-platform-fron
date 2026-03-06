import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import TopKitoblarSection from "./TopKitoblarSection";

const TopKitoblarPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="max-w-7xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[#2B2B2B] sm:text-3xl">
            Eng ko'p o'qilganlar
          </h1>
          <p className="text-sm text-[#6B6B6B]">
            Eng ko'p o'qilgan top kitoblar ro'yxati.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B4F3A] hover:text-[#5A4030]"
        >
          <ArrowLeft size={16} />
          Orqaga
        </button>
      </div>

      <TopKitoblarSection layout="grid" showHeader={false} />
    </section>
  );
};

export default TopKitoblarPage;
