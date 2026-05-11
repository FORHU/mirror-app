"use client";

import { useRef, useState } from "react";
import type { Swiper as SwiperType } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Navigation, Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/navigation";
import "swiper/css/pagination";

export type CarouselItem = {
  id: string;
  label: string;
  imageUrl: string | null;
};

interface GarmentCarouselProps {
  items: CarouselItem[];
  slotLabel: string;
  onSelect: (item: CarouselItem) => void;
}

export default function GarmentCarousel({ items, slotLabel, onSelect }: GarmentCarouselProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const swiperRef = useRef<SwiperType | null>(null);

  function handleConfirm() {
    const idx = swiperRef.current?.realIndex ?? activeIdx;
    onSelect(items[idx] ?? items[0]);
  }

  return (
    <div className="w-full flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <h2 className="text-3xl font-light text-white/80 tracking-wide">{slotLabel}</h2>
        <p className="text-white/35 text-xl font-light">
          <span className="text-white/65 text-2xl">{String(activeIdx + 1).padStart(2, "0")}</span>
          /{String(items.length).padStart(2, "0")}
        </p>
      </div>

      {/* Swiper */}
      <Swiper
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        initialSlide={0}
        loop={items.length > 2}
        navigation
        pagination={{ clickable: true }}
        coverflowEffect={{
          rotate: 0,
          stretch: 0,
          depth: 130,
          modifier: 2.4,
          slideShadows: false,
          scale: 0.78,
        }}
        modules={[EffectCoverflow, Navigation, Pagination]}
        className="garment-swiper w-full"
        onSwiper={(s) => { swiperRef.current = s; }}
        onRealIndexChange={(s) => setActiveIdx(s.realIndex)}
      >
        {items.map((item) => (
          <SwiperSlide key={item.id} className="!w-[220px]">
            <div
              className={`relative overflow-hidden rounded-[28px] shadow-xl ${
                item.imageUrl ? "bg-white" : "bg-white/10 border-2 border-white/20"
              }`}
            >
              {/* Image / placeholder */}
              <div className="h-[300px] w-full flex items-center justify-center">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.label}
                    draggable={false}
                    className="w-full h-full object-contain p-6"
                  />
                ) : (
                  <span className="text-white/50 text-2xl font-light">None</span>
                )}
              </div>

              {/* Label overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 py-4 px-3 bg-gradient-to-t from-black/50 to-transparent text-center">
                <span className="text-white text-xl font-light tracking-wide drop-shadow">
                  {item.label}
                </span>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Select button */}
      <div className="flex justify-center px-6">
        <button
          onClick={handleConfirm}
          className="w-full max-w-xs py-4 rounded-2xl bg-white text-black font-bold text-lg shadow-lg active:scale-95 transition-transform"
        >
          Select
        </button>
      </div>

      <style jsx global>{`
        .garment-swiper {
          padding-bottom: 52px !important;
          overflow: visible !important;
        }
        .garment-swiper .swiper-pagination {
          bottom: 0;
        }
        .garment-swiper .swiper-pagination-bullet {
          width: 26px;
          height: 5px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
          opacity: 1;
          transition: all 0.25s ease;
        }
        .garment-swiper .swiper-pagination-bullet-active {
          background: rgba(255, 255, 255, 0.85);
          width: 34px;
        }
        .garment-swiper .swiper-button-next,
        .garment-swiper .swiper-button-prev {
          width: 46px;
          height: 46px;
          border-radius: 999px;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: white;
          top: 40%;
          transform: translateY(-50%);
        }
        .garment-swiper .swiper-button-next:after,
        .garment-swiper .swiper-button-prev:after {
          font-size: 14px;
          font-weight: 800;
        }
        .garment-swiper .swiper-button-disabled {
          opacity: 0.3;
        }
      `}</style>
    </div>
  );
}
