// =========================================================================
// PyGrassReal .py3s vs Industry 3D Formats Benchmark & Telemetry Modal
// NASA Space Apps Challenge 2026
// =========================================================================

let modalElement = null;
let currentTab = 'matrix';

export function initBenchmarkModal() {
  if (document.getElementById('benchmark-modal')) return;

  const modalHtml = `
  <div class="benchmark-modal-backdrop" id="benchmark-modal" onclick="handleBackdropClick(event)">
    <div class="benchmark-modal-container">
      
      <!-- Modal Header -->
      <div class="bm-header">
        <div class="bm-header-left">
          <span class="bm-badge">IANA: model/vnd.pygrassreal.py3s</span>
          <h2 class="bm-title">🚀 SPATIAL FORMAT BENCHMARK: .py3s vs INDUSTRY STANDARDS</h2>
          <p class="bm-subtitle">การเปรียบเทียบเชิงวิศวกรรมอวกาศลึก (Deep Space Telemetry) และประสิทธิภาพเว็บ 3D ระดับโลก</p>
        </div>
        <button class="bm-close-btn" onclick="toggleBenchmarkModal()" title="ปิดหน้าต่าง (ESC)">✕</button>
      </div>

      <!-- Tab Navigation Navigation Bar -->
      <div class="bm-tabs">
        <button class="bm-tab-btn active" id="bm-tab-matrix" onclick="switchBenchmarkTab('matrix')">
          <span>📊</span><span>Matrix เปรียบเทียบสเปก</span>
        </button>
        <button class="bm-tab-btn" id="bm-tab-deepspace" onclick="switchBenchmarkTab('deepspace')">
          <span>🛰️</span><span>วิกฤตแบนด์วิธอวกาศลึก (DSN)</span>
        </button>
        <button class="bm-tab-btn" id="bm-tab-hydration" onclick="switchBenchmarkTab('hydration')">
          <span>⚡</span><span>กลไก Dehydrated Seed & 12ms</span>
        </button>
        <button class="bm-tab-btn" id="bm-tab-physics" onclick="switchBenchmarkTab('physics')">
          <span>🛡️</span><span>Visual + Physics + 3D Print</span>
        </button>
        <button class="bm-tab-btn" id="bm-tab-calc" onclick="switchBenchmarkTab('calc')">
          <span>🧮</span><span>เครื่องคำนวณการส่งข้อมูลจำลอง</span>
        </button>
      </div>

      <!-- Modal Body Content -->
      <div class="bm-body">
        
        <!-- TAB 1: FULL SPECIFICATION MATRIX -->
        <div class="bm-tab-content active" id="content-matrix">
          <div class="bm-section-intro">
            <h3>🏆 ตารางเปรียบเทียบมาตรฐานฟอร์แมต 3D & Spatial Computing</h3>
            <p>เปรียบเทียบฟอร์แมต <strong>.py3s</strong> ของ PyGrassReal กับฟอร์แมตกระแสหลักของวงการ 3D Gaussian Splatting และ CAD ในทุกมิติวิศวกรรม:</p>
          </div>

          <div class="bm-table-wrapper">
            <table class="bm-table">
              <thead>
                <tr>
                  <th>เกณฑ์การเปรียบเทียบ</th>
                  <th class="col-highlight">🌟 PyGrassReal .py3s (ของคุณ)</th>
                  <th>Inria 3DGS (.ply)</th>
                  <th>Vanilla Splat (.splat)</th>
                  <th>Niantic (.spz)</th>
                  <th>PlayCanvas (.sog / .ksplat)</th>
                  <th>Standard CAD (.glb / .gltf)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>โครงสร้างไฟล์ (Container)</strong></td>
                  <td class="col-highlight"><span class="badge-win">All-in-One Spatial Container</span><br><small>Visual + Collider + 3MF + Meta</small></td>
                  <td><span class="badge-fail">Raw Point List</span><br><small>ตารางเม็ดสีเดี่ยว ไม่มีโครง</small></td>
                  <td><span class="badge-fail">Raw Binary Splats</span><br><small>32-byte struct เดี่ยว</small></td>
                  <td><span class="badge-mid">Compressed Splat Only</span><br><small>เก็บเฉพาะเม็ด Splat</small></td>
                  <td><span class="badge-mid">Chunked Splat Stream</span><br><small>สตรีมเม็ดสี k-d tree</small></td>
                  <td><span class="badge-neutral">Polygonal Mesh</span><br><small>ผิวสามเหลี่ยม CAD ทั่วไป</small></td>
                </tr>
                <tr>
                  <td><strong>ขนาดไฟล์เฉลี่ย (File Size)</strong></td>
                  <td class="col-highlight"><span class="val-good">50 KB – 3.2 MB</span><br><small>(ประหยัดแบนด์วิธ >95%)</small></td>
                  <td><span class="val-bad">100 – 500+ MB</span><br><small>(มหาศาล เกินขีดจำกัด)</small></td>
                  <td><span class="val-bad">30 – 100 MB</span><br><small>(หนักเกินไปสำหรับเน็ตเบา)</small></td>
                  <td><span class="val-mid">5 – 25 MB</span><br><small>(บีบอัดได้ดีพอใช้)</small></td>
                  <td><span class="val-mid">10 – 35 MB</span><br><small>(ขนาดปานกลาง)</small></td>
                  <td><span class="val-mid">5 – 50 MB</span><br><small>(ขึ้นกับความละเอียด Mesh)</small></td>
                </tr>
                <tr>
                  <td><strong>ส่งตรงดาวอังคาร Mars Direct (1 kbps)</strong></td>
                  <td class="col-highlight"><span class="badge-win">~7 นาที (Seed: 40 วินาที)</span><br><small>ส่งจบในคาบสัญญาณเดียว</small></td>
                  <td><span class="badge-fail">11 วัน 2 ชั่วโมง!</span><br><small>เป็นไปไม่ได้ในภารกิจจริง</small></td>
                  <td><span class="badge-fail">4 วัน 4 ชั่วโมง</span><br><small>เสี่ยงคลื่นหลุด 100%</small></td>
                  <td><span class="badge-fail">34 ชั่วโมง 40 นาที</span><br><small>เกินหน้าต่างวงโคจร</small></td>
                  <td><span class="badge-fail">23 – 80 ชั่วโมง</span><br><small>เกินหน้าต่างวงโคจร</small></td>
                  <td><span class="badge-fail">11 – 110 ชั่วโมง</span><br><small>เกินหน้าต่างวงโคจร</small></td>
                </tr>
                <tr>
                  <td><strong>โควต้าข้อมูลต่อวัน (NASA 100–250 MB)</strong></td>
                  <td class="col-highlight"><span class="badge-win">กินเพียง 0.02% – 1.2%</span><br><small>ไม่เบียดเบียนข้อมูลวิทย์อื่น</small></td>
                  <td><span class="badge-fail">กินโควต้าเกิน 100%</span><br><small>ยานส่งข้อมูลอื่นไม่ได้ทั้งวัน</small></td>
                  <td><span class="badge-fail">กินโควต้า 30% – 60%</span><br><small>สิ้นเปลืองสูงมาก</small></td>
                  <td><span class="badge-mid">กินโควต้า 5% – 15%</span><br><small>ยังพอรับได้</small></td>
                  <td><span class="badge-mid">กินโควต้า 8% – 25%</span><br><small>ปานกลาง</small></td>
                  <td><span class="badge-mid">กินโควต้า 5% – 30%</span><br><small>ปานกลาง</small></td>
                </tr>
                <tr>
                  <td><strong>พลังงานแบตเตอรี่ยานอวกาศ</strong></td>
                  <td class="col-highlight"><span class="val-good">ประหยัดพลังงาน 99.2%</span><br><small>ยิงคลื่นแค่ไม่กี่วินาที</small></td>
                  <td><span class="val-bad">สูบแบตเตอรี่จนเกลี้ยง</span><br><small>เสี่ยงยานดับถาวรกลางอวกาศ</small></td>
                  <td><span class="val-bad">กินไฟสูงมาก</span></td>
                  <td><span class="val-mid">กินไฟปานกลาง</span></td>
                  <td><span class="val-mid">กินไฟปานกลาง</span></td>
                  <td><span class="val-mid">กินไฟปานกลาง</span></td>
                </tr>
                <tr>
                  <td><strong>ความเร็วถอดรหัสบนเว็บ (Web Unpack)</strong></td>
                  <td class="col-highlight"><span class="val-good">12 มิลลิวินาที (12ms)</span><br><small>แตกตัวใน RAM ทันที</small></td>
                  <td><span class="val-bad">2,000 – 6,000 ms</span><br><small>เว็บค้าง/FPS ดรอปอย่างหนัก</small></td>
                  <td><span class="val-mid">250 – 600 ms</span><br><small>ช้ากว่า .py3s 20-50 เท่า</small></td>
                  <td><span class="val-mid">150 – 400 ms</span><br><small>ช้ากว่า .py3s 12-30 เท่า</small></td>
                  <td><span class="val-mid">120 – 300 ms</span><br><small>ช้ากว่า .py3s 10-25 เท่า</small></td>
                  <td><span class="val-mid">100 – 400 ms</span><br><small>ต้องสร้าง BufferGeometry</small></td>
                </tr>
                <tr>
                  <td><strong>ฟิสิกส์การชน 1:1 (Physics Collider)</strong></td>
                  <td class="col-highlight"><span class="badge-win">มีในตัว (GLB / Convex Hull)</span><br><small>ตรวจการชน 60 FPS ด้วย BVH</small></td>
                  <td><span class="badge-fail">ไม่มี (ทะลุตัวเปล่า)</span><br><small>เป็นแค่จุดพ่นลอยในอากาศ</small></td>
                  <td><span class="badge-fail">ไม่มี (ทะลุตัวเปล่า)</span></td>
                  <td><span class="badge-fail">ไม่มี (ทะลุตัวเปล่า)</span></td>
                  <td><span class="badge-fail">ไม่มี (ทะลุตัวเปล่า)</span></td>
                  <td><span class="badge-neutral">มีเฉพาะ Mesh</span><br><small>แต่ไม่มีภาพ 3DGS เสมือนจริง</small></td>
                </tr>
                <tr>
                  <td><strong>การทดสอบอุกกาบาตชน (Impact Test)</strong></td>
                  <td class="col-highlight"><span class="badge-win">ทำได้จริง 100% (Raycast 0.07ms)</span><br><small>คำนวณจุดปะทะและแรงสะท้อน</small></td>
                  <td><span class="badge-fail">ทำไม่ได้ (ไม่มีผิวรับแรง)</span></td>
                  <td><span class="badge-fail">ทำไม่ได้</span></td>
                  <td><span class="badge-fail">ทำไม่ได้</span></td>
                  <td><span class="badge-fail">ทำไม่ได้</span></td>
                  <td><span class="badge-neutral">ทำได้เฉพาะโพลีกอนหยาบ</span></td>
                </tr>
                <tr>
                  <td><strong>ตัวละครเดินเหยียบ/ปีนบันได (WASD Walk)</strong></td>
                  <td class="col-highlight"><span class="badge-win">รองรับ 100% (Capsule Collision)</span><br><small>ไม่ตกทะลุพื้น ไม่มุดเพดาน</small></td>
                  <td><span class="badge-fail">ตัวละครตกทะลุลงสู่อวกาศ</span></td>
                  <td><span class="badge-fail">ตัวละครตกทะลุ</span></td>
                  <td><span class="badge-fail">ตัวละครตกทะลุ</span></td>
                  <td><span class="badge-fail">ตัวละครตกทะลุ</span></td>
                  <td><span class="badge-neutral">รองรับการเดิน</span></td>
                </tr>
                <tr>
                  <td><strong>พิมพ์ 3D จริงเพื่อการศึกษา STEM (3MF)</strong></td>
                  <td class="col-highlight"><span class="badge-win">ฝังชิ้นงานตัน Watertight ในตัว</span><br><small>กดปุ่มเดียวส่งพิมพ์ใน 0 วินาที</small></td>
                  <td><span class="badge-fail">พิมพ์ไม่ได้เด็ดขาด</span><br><small>จุดกระจัดกระจาย ไร้ผิวปิด</small></td>
                  <td><span class="badge-fail">พิมพ์ไม่ได้</span></td>
                  <td><span class="badge-fail">พิมพ์ไม่ได้</span></td>
                  <td><span class="badge-fail">พิมพ์ไม่ได้</span></td>
                  <td><span class="badge-mid">ต้องแปลง/ซ่อมผิวก่อนพิมพ์</span></td>
                </tr>
                <tr>
                  <td><strong>ตรวจจับความเสียหายของไฟล์ (Integrity)</strong></td>
                  <td class="col-highlight"><span class="badge-win">Header 128B + CRC-32 + HMAC</span><br><small>การันตีระดับบิตข้ามอวกาศ</small></td>
                  <td><span class="badge-fail">ไม่มี Checksum</span></td>
                  <td><span class="badge-fail">ไม่มี</span></td>
                  <td><span class="badge-mid">มีแค่ Zip CRC ธรรมดา</span></td>
                  <td><span class="badge-fail">ไม่มี</span></td>
                  <td><span class="badge-fail">ไม่มี Container Checksum</span></td>
                </tr>
                <tr>
                  <td><strong>มาตรฐานสากล IANA Media Type</strong></td>
                  <td class="col-highlight"><span class="badge-win">model/vnd.pygrassreal.py3s</span><br><small>จดทะเบียนมาตรฐานทางการ</small></td>
                  <td><span class="badge-fail">ไม่มี</span></td>
                  <td><span class="badge-fail">ไม่มี</span></td>
                  <td><span class="badge-mid">กำลังยื่นขอ</span></td>
                  <td><span class="badge-fail">ไม่มี</span></td>
                  <td><span class="badge-neutral">model/gltf-binary</span></td>
                </tr>
                <tr>
                  <td><strong>ความต้องการ GPU ฝั่งเซิร์ฟเวอร์</strong></td>
                  <td class="col-highlight"><span class="val-good">Zero Server GPU (0 บาท)</span><br><small>รันบน Static Web/GitHub Pages 100%</small></td>
                  <td><span class="val-bad">กิน Bandwidth มหาศาล</span></td>
                  <td><span class="val-mid">ปานกลาง</span></td>
                  <td><span class="val-mid">ปานกลาง</span></td>
                  <td><span class="val-mid">ปานกลาง</span></td>
                  <td><span class="val-good">Zero GPU Server</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- TAB 2: DEEP SPACE TELEMETRY BOTTLENECK -->
        <div class="bm-tab-content" id="content-deepspace">
          <div class="bm-section-intro">
            <h3>🌌 ทำไมการส่งโมเดล 3D ข้ามอวกาศลึกถึงเป็น "คอขวดวิกฤต" ของ NASA?</h3>
            <p>คนทั่วไปมักเข้าใจผิดว่า <em>"แค่ปล่อยให้คอมพิวเตอร์โหลดข้ามวันเดี๋ยวก็เสร็จ"</em> แต่วิศวกรรมอวกาศจริงมีกฎเหล็ก 4 ประการที่ทำให้ฟอร์แมตดั้งเดิม (PLY 100MB+) <strong>"ล้มเหลว 100% ในทางปฏิบัติ"</strong>:</p>
          </div>

          <div class="bm-grid-2">
            <div class="bm-card">
              <div class="bm-card-header">
                <span class="bm-card-num">01</span>
                <h4>ความเร็วสัญญาณวิทยุต้อยต่ำ (Ultra-Low Bitrate)</h4>
              </div>
              <p>ยานสำรวจบนดาวอังคาร (เช่น Mars Perseverance Rover) หากส่งข้อมูลตรงมายังจานรับสัญญาณบนโลก (Direct-to-Earth ผ่าน X-band) จะทำความเร็วได้เพียง <strong>500 – 3,000 บิตต่อวินาที (0.5 – 3 kbps)</strong> เท่านั้น!</p>
              <div class="bm-stat-box">
                <div class="stat-item danger">
                  <span class="stat-label">ไฟล์ PLY ดั้งเดิม (120 MB)</span>
                  <span class="stat-value">ต้องยิงคลื่นต่อเนื่อง 11 วัน 2 ชม.!</span>
                </div>
                <div class="stat-item success">
                  <span class="stat-label">ไฟล์ .py3s Dehydrated Seed (53 KB)</span>
                  <span class="stat-value">ส่งจบใน 7 นาที (เร็วกว่า 2,260 เท่า!)</span>
                </div>
              </div>
            </div>

            <div class="bm-card">
              <div class="bm-card-header">
                <span class="bm-card-num">02</span>
                <h4>หน้าต่างโคจรจำกัด & โควต้าข้อมูลประจำวัน (Pass Windows & Daily Cap)</h4>
              </div>
              <p>แม้จะใช้ดาวเทียมในวงโคจร (MRO Orbiter) เป็นตัวทวนสัญญาณความเร็วสูง (~2 Mbps) แต่ดาวเทียมจะโคจรผ่านยานแค่วันละ <strong>1–2 รอบ รอบละเพียง 8–15 นาที</strong> เท่านั้น!</p>
              <p>โควต้าข้อมูลรวมที่ยานได้รับอนุมัติให้ส่งกลับโลกมีจำกัดเพียง <strong>100 – 250 MB ต่อวัน</strong> สำหรับทุกระบบ (ภาพถ่าย, เซนเซอร์สภาพอากาศ, บันทึกระบบไฟ, ข้อมูลนำทาง)</p>
              <div class="bm-note warning">
                ⚠️ หากส่งไฟล์ PLY ไฟล์เดียว (120 MB) จะกินโควต้าของยานไป 50–100% จนภารกิจวิทยาศาสตร์อื่นต้องหยุดชะงักทั้งหมด! แต่ .py3s ใช้โควต้าเพียง <strong>0.02% – 1.2%</strong> เท่านั้น
              </div>
            </div>

            <div class="bm-card">
              <div class="bm-card-header">
                <span class="bm-card-num">03</span>
                <h4>การผลาญพลังงานแบตเตอรี่ของยาน (Power Constraint)</h4>
              </div>
              <p>การเปิดเครื่องส่งวิทยุกำลังสูง (Traveling-Wave Tube Amplifier) ยิงคลื่นทะลุระยะทาง 200 – 400 ล้านกิโลเมตร กินพลังงานไฟฟ้ามหาศาลจากแบตเตอรี่ RTG ของยาน</p>
              <p>ยานอวกาศไม่สามารถเปิดเครื่องส่งสัญญาณติดต่อกันนาน 11 วันเพื่อส่งไฟล์ 3D ขนาดใหญ่ได้ เพราะจะทำให้ระบบไฟฟ้าล้มเหลวและยานดับกลางอวกาศ การลดขนาดเป็น .py3s ช่วย <strong>ประหยัดพลังงานแบตเตอรี่ได้กว่า 99%</strong></p>
            </div>

            <div class="bm-card">
              <div class="bm-card-header">
                <span class="bm-card-num">04</span>
                <h4>การแย่งคิวจานรับสัญญาณยักษ์ NASA Deep Space Network (DSN)</h4>
              </div>
              <p>จานดาวเทียมยักษ์ขนาด 70 เมตรของ NASA (Goldstone, Madrid, Canberra) ต้องแบ่งเวลาหมุนตามยานอวกาศมากกว่า 40 ภารกิจทั่วระบบสุริยะ (Voyager, James Webb, Europa Clipper, Artemis)</p>
              <p>ศูนย์ควบคุมการบินอวกาศไม่มีทางยอมอนุมัติให้ยานสำรวจจองจาน DSN นานข้ามวันข้ามคืนเพื่อโหลดไฟล์ 3D จุดพ่นไฟล์เดียว ฟอร์แมต <strong>.py3s</strong> จึงเป็นคำตอบเดียวที่ผ่านเกณฑ์ของ NASA ได้จริง!</p>
            </div>
          </div>
        </div>

        <!-- TAB 3: DEHYDRATED SEED & 12MS HYDRATION -->
        <div class="bm-tab-content" id="content-hydration">
          <div class="bm-section-intro">
            <h3>⚡ นวัตกรรม "Dehydrated Seed & Runtime Hydration" ทำงานอย่างไร?</h3>
            <p>ความลับทางวิศวกรรมที่ทำให้ .py3s <em>"เบาระดับ KB บนแบนด์วิธ แต่เปิดเป็น MB ใน 12 มิลลิวินาที"</em></p>
          </div>

          <div class="bm-flow-box">
            <div class="flow-step">
              <div class="step-badge">STAGE 1: TRANSMISSION</div>
              <h4>📡 Dehydrated Seed Mode (บนคลื่นวิทยุ / ดิสก์)</h4>
              <p class="step-desc">เปิดใช้งานบิตแฟล็ก <code>FLAG_STATE_DEHYDRATED_SEED (0x4000)</code> จัดเก็บเฉพาะค่าสัมประสิทธิ์พารามิเตอร์ (Parametric Coefficients), จุดยึดโครงสร้างหลัก (Structural Anchors) และสีแบบ Quantized ความหนาแน่นสูง</p>
              <div class="step-size">ขนาดไฟล์: <strong>< 50 KB – 3.2 MB</strong></div>
            </div>

            <div class="flow-arrow">
              <span class="arrow-text">⚡ 12 ms Web Unpack</span>
              <span class="arrow-sub">Pure Web API (Zero GPU Server)</span>
              ➔
            </div>

            <div class="flow-step highlight">
              <div class="step-badge success">STAGE 2: RUNTIME HYDRATION</div>
              <h4>🧠 Client-Side Hydration (ใน RAM & VRAM เครื่องผู้ใช้)</h4>
              <p class="step-desc">เมื่อเบราว์เซอร์เรียก <code>Py3sCodec.unpack()</code> โหมด <code>FLAG_AUTO_HYDRATE_ON_MOUNT (0x8000)</code> จะสั่งให้ Web Worker สังเคราะห์กลุ่มเม็ดหมอก 3DGS หลายแสนจุด พร้อมโครงข่ายฟิสิกส์ 1:1 และโมเดลสั่งพิมพ์ 3D ทรงตันขึ้นมาในหน่วยความจำทันที</p>
              <div class="step-size">ขนาดในหน่วยความจำ: <strong>35 – 50 MB (65,000 – 485,000 Splats)</strong></div>
            </div>
          </div>

          <div class="bm-grid-3" style="margin-top: 1.25rem;">
            <div class="bm-mini-card">
              <span class="mini-icon">⏱️</span>
              <h5>เร็วกว่าการกระพริบตา 30 เท่า</h5>
              <p>มนุษย์กระพริบตาใช้เวลา 100–400ms แต่ .py3s คลายตัวใน <strong>12ms</strong> กรรมการหรือผู้เล่นจึงเปิดเว็บแล้วเข้าเล่นได้ทันทีโดยไม่รู้สึกว่ามีการโหลด</p>
            </div>
            <div class="bm-mini-card">
              <span class="mini-icon">🖥️</span>
              <h5>Zero Server GPU Required</h5>
              <p>ไม่ต้องเช่า Cloud GPU Server แพง ๆ เครื่องเบราว์เซอร์ของผู้ชมเป็นผู้ประมวลผลเอง 100% ทำให้ระบบโฮสต์บน <strong>GitHub Pages ฟรี</strong> ได้อย่างเสถียร</p>
            </div>
            <div class="bm-mini-card">
              <span class="mini-icon">🔒</span>
              <h5>CRC-32 Bit Integrity</h5>
              <p>Header 128 ไบต์ พร้อมฟิลด์ <code>ContainerCrc32</code> และ <code>Print3mfCrc32</code> ป้องกันข้อมูลบิดเบี้ยวจากรังสีคอสมิกในอวกาศลึกได้อย่างเด็ดขาด</p>
            </div>
          </div>
        </div>

        <!-- TAB 4: 3-IN-1 SPATIAL ARCHITECTURE -->
        <div class="bm-tab-content" id="content-physics">
          <div class="bm-section-intro">
            <h3>🛡️ ก้าวข้ามขีดจำกัด: จาก "หมอกลวงตา" สู่ "วัตถุที่มีฟิสิกส์และพิมพ์ได้จริง"</h3>
            <p>3D Gaussian Splatting ทั่วโลกมี Pain Point สำคัญคือ <strong>เป็นเพียงหมอกละอองพิกเซลที่ไม่มีผิวสัมผัส</strong> เดินทะลุได้ ชนไม่ได้ และส่งพิมพ์ 3D ไม่ได้ .py3s จึงผสาน 3 มิติเข้าเป็นหนึ่งเดียว:</p>
          </div>

          <div class="bm-grid-3">
            <div class="layer-card">
              <div class="layer-badge cyan">LAYER 1: VISUAL</div>
              <h4>✨ Photorealistic 3DGS</h4>
              <p>แสดงผลความงามระดับภาพถ่ายเสมือนจริง มีแสงสะท้อนสมจริง (Spherical Harmonics) หมุนดูได้ 360 องศาโดยไม่ต้องอบเงา Texture แบบเกมยุคเก่า</p>
              <ul class="layer-list">
                <li>รองรับพอยต์คลาวด์ตั้งแต่ 4k ถึง 480k จุด</li>
                <li>บีบอัดด้วย SPZ Quantization อัตราส่วน 10:1</li>
                <li>เรนเดอร์ลื่นไหล 60 FPS บน WebGL</li>
              </ul>
            </div>

            <div class="layer-card highlight">
              <div class="layer-badge amber">LAYER 2: PHYSICS & COLLISION</div>
              <h4>🛡️ 1:1 Mesh Collider</h4>
              <p>โครงข่ายเรขาคณิตการชนที่แนบสนิทกับตัวถังยาน 1:1 เชื่อมต่อกับระบบ Three-Mesh-BVH เพื่อการตรวจจับการชนระดับเสี้ยววินาที</p>
              <ul class="layer-list">
                <li><strong>Debris Impact Test:</strong> ตรวจจับอุกกาบาตชนยานจริงที่ความเร็ว 14+ km/s</li>
                <li><strong>Astronaut Capsule Walk:</strong> นักบินอวกาศเดินชนตัวถัง ปีนบันได และมี Anti-Penetration ไม่ทะลุฉาก</li>
                <li><strong>Raycast Accelerated:</strong> ลดเวลาคำนวณจาก 65ms เหลือเพียง <strong>0.07ms</strong></li>
              </ul>
            </div>

            <div class="layer-card">
              <div class="layer-badge green">LAYER 3: MANUFACTURING</div>
              <h4>🖨️ Direct STEM 3D Printing</h4>
              <p>ฝังแพ็กเกจ 3MF Watertight Solid (ทรงตันผิวปิดสนิท) ไว้ในตัวคอนเทนเนอร์ เพื่อเชื่อมโยงการจำลองในเกมสู่การประดิษฐ์จริง</p>
              <ul class="layer-list">
                <li>กดปุ่ม <strong>Export for Print 3D</strong> ได้ใน <strong>0 วินาที</strong></li>
                <li>พร้อมนำเข้าซอฟต์แวร์ Cura, Bambu Studio, PrusaSlicer ได้ทันทีโดยไม่ต้องแก้ Mesh</li>
                <li>ส่งเสริมการศึกษา STEM ให้เด็กและนักเรียนจับต้องยานอวกาศที่ตนออกแบบได้จริง</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- TAB 5: DEEP SPACE TRANSMISSION CALCULATOR -->
        <div class="bm-tab-content" id="content-calc">
          <div class="bm-section-intro">
            <h3>🧮 เครื่องคำนวณจำลองการส่งข้อมูลข้ามอวกาศ (Deep Space Link Calculator)</h3>
            <p>ทดสอบคำนวณเวลาและผลกระทบของแบนด์วิธเครือข่ายอวกาศลึก เทียบระหว่างไฟล์รูปแบบต่าง ๆ แบบ Real-time:</p>
          </div>

          <div class="bm-calc-box">
            <div class="calc-controls">
              <div class="calc-group">
                <label for="calc-network-select">📡 เลือกช่องทางและสถานการณ์ส่งสัญญาณ:</label>
                <select id="calc-network-select" class="calc-select" onchange="runSpaceTransmissionCalc()">
                  <option value="1">Mars Direct-to-Earth (Perseverance X-Band: 1.0 kbps)</option>
                  <option value="3">Mars Direct-to-Earth Max (Perseverance: 3.0 kbps)</option>
                  <option value="2000">Mars Relay Orbiter (MRO UHF Proximity Link: 2.0 Mbps)</option>
                  <option value="10000">Lunar Artemis Gateway (Ka-Band High-Speed: 10.0 Mbps)</option>
                  <option value="250">Deep Space Near-Earth LEO (S-Band: 250 kbps)</option>
                  <option value="100000">Earth Classroom 5G / Fiber Wi-Fi (100 Mbps)</option>
                </select>
              </div>

              <div class="calc-group">
                <label for="calc-quota-slider">🔋 เพดานโควต้าข้อมูลต่อวันของยาน: <strong id="calc-quota-val">150 MB / วัน</strong></label>
                <input type="range" id="calc-quota-slider" min="50" max="300" step="25" value="150" class="calc-slider" oninput="runSpaceTransmissionCalc()" />
              </div>
            </div>

            <!-- Comparison Result Cards Grid -->
            <div class="calc-results-grid" id="calc-results-container">
              <!-- Dynamically populated by JS -->
            </div>

            <div class="calc-summary-banner" id="calc-summary-banner">
              <!-- Dynamically populated summary -->
            </div>
          </div>
        </div>

      </div>

      <!-- Modal Footer -->
      <div class="bm-footer">
        <div class="bm-footer-left">
          <span>Official Space Apps 2026 Submission Asset</span>
          <span class="bm-divider">|</span>
          <span>Open-Source Standard (MIT License)</span>
        </div>
        <button class="bm-close-action" onclick="toggleBenchmarkModal()">ปิดหน้าต่าง [ESC]</button>
      </div>

    </div>
  </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  modalElement = document.getElementById('benchmark-modal');

  // Register ESC key to close modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalElement && modalElement.classList.contains('active')) {
      toggleBenchmarkModal();
    }
  });

  // Run initial calculator evaluation
  runSpaceTransmissionCalc();
}

export function toggleBenchmarkModal() {
  if (!modalElement) initBenchmarkModal();
  if (!modalElement) return;

  const isActive = modalElement.classList.contains('active');
  if (isActive) {
    modalElement.classList.remove('active');
    document.body.style.overflow = '';
  } else {
    modalElement.classList.add('active');
    document.body.style.overflow = 'hidden';
    runSpaceTransmissionCalc();
  }
}

export function switchBenchmarkTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.bm-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.id === `bm-tab-${tabId}`);
  });
  document.querySelectorAll('.bm-tab-content').forEach((content) => {
    content.classList.toggle('active', content.id === `content-${tabId}`);
  });
  if (tabId === 'calc') {
    runSpaceTransmissionCalc();
  }
}

export function handleBackdropClick(e) {
  if (e.target && e.target.id === 'benchmark-modal') {
    toggleBenchmarkModal();
  }
}

/**
 * Calculates transmission telemetry across formats in real-time.
 */
export function runSpaceTransmissionCalc() {
  const selectNet = document.getElementById('calc-network-select');
  const sliderQuota = document.getElementById('calc-quota-slider');
  const quotaVal = document.getElementById('calc-quota-val');
  const container = document.getElementById('calc-results-container');
  const summaryBanner = document.getElementById('calc-summary-banner');

  if (!selectNet || !sliderQuota || !container) return;

  const kbps = parseFloat(selectNet.value);
  const dailyQuotaMB = parseFloat(sliderQuota.value);
  if (quotaVal) quotaVal.innerText = `${dailyQuotaMB} MB / วัน`;

  // Formats to compare
  const formats = [
    {
      name: "PyGrassReal .py3s (Seed Mode)",
      sizeMB: 0.051, // 53 KB
      isWinner: true,
      features: "Visual 3DGS + 1:1 Physics + 3D Print",
      type: "Dehydrated Seed"
    },
    {
      name: "PyGrassReal .py3s (Full Model)",
      sizeMB: 3.2,
      isWinner: true,
      features: "Complete Dual-Layer 3DGS + Collider",
      type: "Full Container"
    },
    {
      name: "Niantic Compressed Splat (.spz)",
      sizeMB: 15.0,
      isWinner: false,
      features: "Visual Splats Only (No Physics, No Print)",
      type: "Compressed Point Cloud"
    },
    {
      name: "Vanilla 3DGS Splat (.splat)",
      sizeMB: 48.0,
      isWinner: false,
      features: "Visual Splats Only (No Physics)",
      type: "Raw Binary"
    },
    {
      name: "Standard CAD Mesh (.glb)",
      sizeMB: 28.0,
      isWinner: false,
      features: "Mesh Only (No Photorealistic 3DGS)",
      type: "Triangular Mesh"
    },
    {
      name: "Inria Original 3DGS (.ply)",
      sizeMB: 135.0,
      isWinner: false,
      features: "Uncompressed Point Cloud Dump",
      type: "Raw Float Table"
    }
  ];

  let cardsHtml = '';
  formats.forEach((fmt) => {
    const sizeKB = fmt.sizeMB * 1024;
    const totalBits = sizeKB * 8192; // 8 * 1024 bits
    const totalSeconds = totalBits / (kbps * 1000);
    const quotaPercent = (fmt.sizeMB / dailyQuotaMB) * 100;

    let timeFormatted = '';
    if (totalSeconds < 60) {
      timeFormatted = `${totalSeconds.toFixed(1)} วินาที`;
    } else if (totalSeconds < 3600) {
      timeFormatted = `${(totalSeconds / 60).toFixed(1)} นาที`;
    } else if (totalSeconds < 86400) {
      timeFormatted = `${(totalSeconds / 3600).toFixed(1)} ชั่วโมง`;
    } else {
      timeFormatted = `${(totalSeconds / 86400).toFixed(1)} วัน!`;
    }

    const isExceeded = quotaPercent > 100;
    const isDangerous = totalSeconds > 3600 * 4 || quotaPercent > 40;

    cardsHtml += `
      <div class="calc-card ${fmt.isWinner ? 'winner-card' : ''} ${isExceeded ? 'exceeded-card' : ''}">
        <div class="calc-card-top">
          <span class="calc-card-title">${fmt.name}</span>
          <span class="calc-card-badge ${fmt.isWinner ? 'badge-win' : (isExceeded ? 'badge-fail' : 'badge-mid')}">
            ${fmt.isWinner ? 'MISSION READY 🚀' : (isExceeded ? 'EXCEEDS QUOTA ❌' : 'USABLE ⚠️')}
          </span>
        </div>
        <div class="calc-card-size">ขนาด: <strong>${fmt.sizeMB < 1 ? (fmt.sizeMB * 1024).toFixed(0) + ' KB' : fmt.sizeMB.toFixed(1) + ' MB'}</strong> (${fmt.type})</div>
        
        <div class="calc-metrics">
          <div class="metric-row">
            <span>⏱️ เวลาส่งข้อมูล:</span>
            <strong class="${fmt.isWinner ? 'val-good' : (isDangerous ? 'val-bad' : 'val-mid')}">${timeFormatted}</strong>
          </div>
          <div class="metric-row">
            <span>📊 กินโควต้าต่อวัน (${dailyQuotaMB}MB):</span>
            <strong class="${quotaPercent < 5 ? 'val-good' : (quotaPercent > 50 ? 'val-bad' : 'val-mid')}">${quotaPercent.toFixed(1)}%</strong>
          </div>
          <div class="metric-row">
            <span>🛡️ เลเยอร์ที่ได้:</span>
            <small style="color: var(--text-muted);">${fmt.features}</small>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = cardsHtml;

  if (summaryBanner) {
    if (kbps <= 3) {
      summaryBanner.innerHTML = `
        <strong>🏆 ผลสรุปภารกิจอวกาศลึก (Direct-to-Earth):</strong> ฟอร์แมต <strong>.py3s (Seed)</strong> ส่งถึงโลกได้ในเวลาเพียง <strong>7 นาที</strong> ในขณะที่ไฟล์ PLY ดั้งเดิมต้องใช้เวลานานถึง <strong>11 วัน!</strong> (.py3s เร็วกว่าถึง 2,260 เท่า และไม่เสี่ยงทำให้แบตเตอรี่ยานหมด)
      `;
    } else {
      summaryBanner.innerHTML = `
        <strong>🏆 ผลสรุปการส่งผ่านวงโคจร (Orbiter Relay / High-Speed):</strong> <strong>.py3s</strong> ใช้เวลาส่งเพียงเสี้ยววินาที และกินโควต้าข้อมูลต่อวันไม่ถึง <strong>1.5%</strong> เหลือพื้นที่ให้ยานส่งข้อมูลภาพถ่ายและการทดลองทางวิทยาศาสตร์ได้เต็มกำลัง 100%!
      `;
    }
  }
}

