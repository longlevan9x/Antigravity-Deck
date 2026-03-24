"use client";

import React, { useState } from "react";
import { ZoomIn, ZoomOut, UserPlus, Users } from "lucide-react";

export default function FamilyTreePage() {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.4));

  const handleAdd = (role: string) => {
    alert(`Mở form điền thông tin: Thêm ${role}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Thanh công cụ */}
      <div className="fixed top-0 w-full bg-slate-800 text-white p-4 flex justify-between items-center shadow-md z-50">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 m-0">
          <Users className="w-6 h-6" />
          Gia Phả Họ Nguyễn
        </h1>
        <div className="flex gap-2 relative z-[60]">
          <button
            onClick={handleZoomIn}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-lg font-bold text-lg shadow-[0_4px_0_theme(colors.green.800)] active:shadow-[0_0_0_theme(colors.green.800)] active:translate-y-1 transition-all pointer-events-auto cursor-pointer"
          >
            <ZoomIn className="w-5 h-5" />
            <span className="hidden md:inline">To Ra</span>
          </button>
          <button
            onClick={handleZoomOut}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-lg font-bold text-lg shadow-[0_4px_0_theme(colors.green.800)] active:shadow-[0_0_0_theme(colors.green.800)] active:translate-y-1 transition-all pointer-events-auto cursor-pointer"
          >
            <ZoomOut className="w-5 h-5" />
            <span className="hidden md:inline">Nhỏ Lại</span>
          </button>
        </div>
      </div>

      {/* Vùng sơ đồ */}
      <div 
        className="mt-20 w-screen h-[calc(100vh-80px)] overflow-auto p-12 touch-pan-x touch-pan-y"
        style={{
          backgroundImage: "radial-gradient(#d5d5d5 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}
      >
        <div 
          className="tree-container" 
          style={{ 
            transform: `scale(${zoom})`, 
            transformOrigin: "top center",
            transition: "transform 0.3s ease-out"
          }}
        >
          <ul>
            <li>
              {/* Cụ Tổ */}
              <div className="person male deceased">
                <div className="name">Nguyễn Văn An</div>
                <div className="info">Đời 1 • Sinh: 1920 (Mất: 2005)</div>
                <div className="actions">
                  <button onClick={() => handleAdd("Vợ")} className="btn-add">
                    <UserPlus className="w-4 h-4" /> Thêm Vợ
                  </button>
                  <button onClick={() => handleAdd("Con")} className="btn-add">
                    <UserPlus className="w-4 h-4" /> Thêm Con
                  </button>
                </div>
              </div>

              {/* Thế hệ 2 */}
              <ul>
                <li>
                  <div className="person male">
                    <div className="name">Nguyễn Văn Bính</div>
                    <div className="info">Đời 2 (Trưởng) • Sinh: 1945</div>
                    <div className="actions">
                      <button onClick={() => handleAdd("Vợ")} className="btn-add">
                        <UserPlus className="w-4 h-4" /> Thêm Vợ
                      </button>
                      <button onClick={() => handleAdd("Con")} className="btn-add">
                        <UserPlus className="w-4 h-4" /> Thêm Con
                      </button>
                    </div>
                  </div>
                  
                  {/* Thế hệ 3 */}
                  <ul>
                    <li>
                      <div className="person female">
                        <div className="name">Nguyễn Thị Cúc</div>
                        <div className="info">Đời 3 • Sinh: 1970</div>
                        <div className="actions">
                          <button onClick={() => handleAdd("Chồng/Con")} className="btn-add">
                            <UserPlus className="w-4 h-4" /> Thêm
                          </button>
                        </div>
                      </div>
                    </li>
                    <li>
                      <div className="person male">
                        <div className="name">Nguyễn Văn Dũng</div>
                        <div className="info">Đời 3 • Sinh: 1975</div>
                        <div className="actions">
                          <button onClick={() => handleAdd("Vợ/Con")} className="btn-add">
                            <UserPlus className="w-4 h-4" /> Thêm
                          </button>
                        </div>
                      </div>
                    </li>
                  </ul>
                </li>

                <li>
                  <div className="person female deceased">
                    <div className="name">Nguyễn Thị Bình</div>
                    <div className="info">Đời 2 • Sinh: 1950 (Mất: 2018)</div>
                    <div className="actions">
                      <button onClick={() => handleAdd("Chồng/Con")} className="btn-add">
                        <UserPlus className="w-4 h-4" /> Thêm
                      </button>
                    </div>
                  </div>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>

      {/* CSS vẽ đường cho sơ đồ cây */}
      <style dangerouslySetInnerHTML={{ __html: `
        .tree-container {
          display: flex;
          justify-content: center;
        }
        .tree-container ul {
          padding-top: 20px; 
          position: relative;
          display: flex;
          justify-content: center;
        }
        .tree-container li {
          text-align: center;
          list-style-type: none;
          position: relative;
          padding: 20px 15px 0 15px;
        }

        /* Vẽ gạch ngang */
        .tree-container li::before, .tree-container li::after {
          content: '';
          position: absolute; 
          top: 0; 
          right: 50%;
          border-top: 3px solid #cbd5e1;
          width: 50%; 
          height: 20px;
        }
        .tree-container li::after {
          right: auto; 
          left: 50%;
          border-left: 3px solid #cbd5e1;
        }
        .tree-container li:only-child::after, .tree-container li:only-child::before {
          display: none;
        }
        .tree-container li:only-child { 
          padding-top: 0;
        }
        .tree-container li:first-child::before, .tree-container li:last-child::after {
          border: 0 none;
        }
        .tree-container li:first-child::after {
          border-radius: 12px 0 0 0;
        }
        .tree-container li:last-child::before {
          border-right: 3px solid #cbd5e1;
          border-radius: 0 12px 0 0;
        }

        /* Vẽ gạch dọc đi xuống */
        .tree-container ul ul::before {
          content: '';
          position: absolute; top: 0; left: 50%;
          border-left: 3px solid #cbd5e1;
          width: 0; height: 20px;
        }

        /* Style cho từng node */
        .person {
          border: 3px solid #cbd5e1;
          padding: 16px;
          display: inline-block;
          border-radius: 16px;
          background-color: white;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          min-width: 240px;
          position: relative;
          z-index: 10;
        }
        .person.male {
          border-color: #3b82f6 !important;
          background-color: #eff6ff !important;
        }
        .person.female {
          border-color: #ec4899 !important;
          background-color: #fdf2f8 !important;
        }
        .person.deceased {
          border-color: #64748b !important;
          background-color: #f1f5f9 !important;
        }

        .person .name {
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .person .info {
          font-size: 0.95rem;
          color: #475569;
          margin-bottom: 12px;
        }

        /* Nút thêm */
        .actions {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        .btn-add {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background-color: white;
          border: 2px solid #22c55e;
          color: #22c55e;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-add:hover {
          background-color: #22c55e;
          color: white;
        }
      `}} />
    </div>
  );
}
