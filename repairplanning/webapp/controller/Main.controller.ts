import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import Button from "sap/m/Button";
import Event from "sap/ui/base/Event";
import NavContainer from "sap/m/NavContainer";
import Context from "sap/ui/model/Context";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import MessageToast from "sap/m/MessageToast";

// =====================================================================
// CONFIGURACIÓN DE DATOS DE PRUEBA (Liberación / MRP / Abastecimiento)
// Mientras no exista en SAP la entity OrderSupplySet, estos nodos se simulan.
// =====================================================================
const USE_MOCK_SUPPLY = true;        // false cuando exista el OData real de abastecimiento
const MOCK_FORCE_RELEASE = true;     // true = simula que Tesorería ya autorizó (para ver los nodos MRP)
// "AUTO" reparte escenarios según el número de orden; o fuerza uno: "MIXED" | "PENDING_RUN" | "ALL_AVAILABLE"
const MOCK_SCENARIO: "AUTO" | "MIXED" | "PENDING_RUN" | "ALL_AVAILABLE" = "AUTO";

// ---------- Fases del ciclo de vida (columna "Ciclo") ----------
type PhaseState = "done" | "current" | "blocked" | "pending";
const PHASES = ["Aviso", "Orden", "Oferta", "Liberación", "MRP", "Abasto"];
const PHASE_UI: Record<PhaseState, { icon: string; color: string; label: string }> = {
    done:    { icon: "sap-icon://sys-enter-2", color: "Positive", label: "Completado" },
    current: { icon: "sap-icon://pending",     color: "Critical", label: "En curso" },
    blocked: { icon: "sap-icon://error",       color: "Negative", label: "Bloqueado" },
    pending: { icon: "sap-icon://circle-task", color: "Neutral",  label: "Pendiente" }
};

// ---------- Estados de abastecimiento por componente ----------
type SupplyCode = "PEND_MRP" | "PLANNED" | "IN_TRANSIT" | "AVAILABLE" | "NO_STOCK";
const SUPPLY_STATUS: Record<SupplyCode, { text: string; state: string; icon: string; reached: number }> = {
    PEND_MRP:   { text: "Pendiente MRP",          state: "Warning",     icon: "sap-icon://pending",         reached: 1 },
    PLANNED:    { text: "Traslado planificado",   state: "Information", icon: "sap-icon://create-entry-time", reached: 2 },
    IN_TRANSIT: { text: "En tránsito",            state: "Information", icon: "sap-icon://shipping-status", reached: 3 },
    AVAILABLE:  { text: "Disponible en satélite", state: "Success",     icon: "sap-icon://sys-enter-2",     reached: 4 },
    NO_STOCK:   { text: "Sin stock · SolPed",     state: "Error",       icon: "sap-icon://error",           reached: 1 }
};

const MOCK_COMPONENTS = [
    { matnr: "MAT-1001", maktx: "Válvula de control 3\"", qty: 2, uom: "PZ" },
    { matnr: "MAT-2040", maktx: "Kit de empaques NBR",    qty: 4, uom: "PZ" },
    { matnr: "MAT-3300", maktx: "Sello mecánico 45 mm",   qty: 1, uom: "PZ" }
];

/**
 * @namespace repairplanning.controller
 */
export default class Main extends Controller {

    public onInit(): void {
        const sUserName = "sapmelmex@melco.com.mx";
        console.log("Usuario detectado para la consulta OData:", sUserName);

        const oODataModel = this.getOwnerComponent()?.getModel("ZCS_GET_NOTIFICATION_SRV") as ODataModel;

        if (!oODataModel) {
            console.log("Modelo OData no encontrado en el Manifest. Usando datos de prueba.");
            this._loadMockData();
            return;
        }

        const aFilters = [
            new Filter("CreatedOn", FilterOperator.GE, "2026-10-01T00:00:00"),
            new Filter("NotifDate", FilterOperator.LE, "2026-12-30T23:59:59")
            //new Filter("Userstatus", FilterOperator.EQ, sUserName)
        ];

        oODataModel.read("/NotificationHeaderSet", {
            filters: aFilters,
            success: (oData: any) => {
                if (oData?.results?.length > 0) {
                    const formattedData = {
                        notifications: oData.results.map((item: any) => {
                            const priority = item.Priority || "Normal";
                            const equipment = item.Equipment || "—";
                            return {
                                type: "Aviso",
                                id: item.NotifNo || item.qmnum,
                                description: item.ShortText || item.qmtxt,
                                date: this._formatDate(item.NotifDate || item.erdat),
                                status: item.Userstatus || "Abierto",
                                priority,
                                equipment,
                                detail: `Prioridad: ${priority} | Equipo: ${equipment}`,
                                contract: item.DocNumber || "",
                                posicion: item.ItmNumber || "",
                                circunstance: item.Coding || "",
                                descriptionCircumstance: item.PurchNoC || "",
                                phases: this._buildPhases({ Aviso: "done" }),
                                // Nodo temporal para forzar la flecha de expansión
                                nodes: [this._loadingNode("Cargando...")]
                            };
                        })
                    };
                    this.getView()?.setModel(new JSONModel(formattedData));
                } else {
                    console.log("El OData respondió sin registros. Cargando datos de prueba...");
                    this._loadMockData();
                }
            },
            error: (oError: any) => {
                console.warn("No se pudo conectar al servicio OData. Usando datos de prueba.", oError);
                this._loadMockData();
            }
        });
    }

    // =====================================================================
    // DATOS DE PRUEBA COMPLETOS (cuando no hay OData)
    // =====================================================================
    private _loadMockData(): void {
        const notifications = ["400102", "400103", "400104"].map((sOrd, i) => {
            const order: any = {
                type: "Orden de Manto",
                id: `ORD-${sOrd}`,
                description: "Orden de trabajo para sustitución de válvula",
                date: this._formatDate("2026-08-02"),
                status: "En Proceso",
                craft: "Mecánica Industrial",
                workCenter: "Taller Central",
                detail: "Pto. trabajo: Mecánica Industrial | Centro: Taller Central",
                parentNotifNo: `AV-80010${i + 1}`
            };
            const quot: any = {
                type: "Cotización",
                id: `COT-30010${i + 3}`,
                description: "Cotización de refacción/servicio",
                date: this._formatDate("2026-08-03"),
                status: "Finalizada",
                statusState: "Success",
                statusIcon: "sap-icon://sys-enter-2",
                amount: "1,450.00 USD",
                detail: "Importe: 1,450.00 USD",
                nodes: []
            };
            order.nodes = [quot, ...this._buildSupplyNodes(order, [quot])];
            return {
                type: "Aviso",
                id: `AV-80010${i + 1}`,
                description: "Falla crítica detectada en sistema hidráulico principal",
                date: this._formatDate("2026-08-01"),
                status: "Abierto",
                priority: "Alta",
                equipment: "EQ-9021",
                detail: "Prioridad: Alta | Equipo: EQ-9021",
                phases: [],
                nodes: [order]
            };
        });

        this.getView()?.setModel(new JSONModel({ notifications }));
        notifications.forEach((_n, i) => this._updateAvisoPhases(`/notifications/${i}`));
    }

    // =====================================================================
    // EXPANSIÓN PEREZOSA DEL ÁRBOL
    // =====================================================================
    public onToggleOpenState(oEvent: any): void {
        const bExpanded = oEvent.getParameter("expanded");
        const oRowContext = oEvent.getParameter("rowContext");
        if (!bExpanded || !oRowContext) {
            return;
        }

        const oNodeData = oRowContext.getObject();
        const sModelPath: string = oRowContext.getPath();
        const oViewModel = this.getView()?.getModel() as JSONModel;
        const oODataModel = this.getOwnerComponent()?.getModel("ZCS_GET_NOTIFICATION_SRV") as ODataModel;
        if (!oODataModel) {
            return;
        }

        // ---------- CASO 1: AVISO -> Órdenes ----------
        if (oNodeData.type === "Aviso" && (!oNodeData.nodes || oNodeData.nodes[0]?.type === "Loading")) {
            const sNotifNo = oNodeData.id;
            oODataModel.read(`/NotificationHeaderSet('${sNotifNo}')/NotificationOrderSet`, {
                success: (oData: any) => {
                    const aOrders = (oData?.results || []).map((order: any) => {
                        const sWorkCenter = order.WorkCenter || order.Arbpl || "—";
                        const sPlant = order.Plant || order.Werks || "—";
                        return {
                            type: "Orden de Manto",
                            id: order.OrderId || order.Aufnr,
                            description: order.Texto || order.Ktext || "Orden de Mantenimiento",
                            date: this._formatDate(order.Inicio || order.Gstrp),
                            status: "En Proceso", // TODO: traer el status de sistema real (SysStatus)
                            detail: `Pto. trabajo: ${sWorkCenter} | Centro: ${sPlant}`,
                            parentNotifNo: sNotifNo,
                            nodes: [this._loadingNode("Cargando cotizaciones...")]
                        };
                    });
                    oViewModel.setProperty(sModelPath + "/nodes", aOrders);
                    this._updateAvisoPhases(sModelPath);
                },
                error: (oError: any) => console.error("Error al cargar las órdenes hijas:", oError)
            });
        }

        // ---------- CASO 2: ORDEN -> Cotizaciones + Liberación + MRP ----------
        else if (oNodeData.type === "Orden de Manto" && (!oNodeData.nodes || oNodeData.nodes[0]?.type === "Loading")) {
            const sNotifNo = oNodeData.parentNotifNo;
            const sAvisoPath = this._parentPath(sModelPath);

            const fnSetChildren = (aQuotations: any[]) => {
                const aSupply = USE_MOCK_SUPPLY ? this._buildSupplyNodes(oNodeData, aQuotations) : [];
                oViewModel.setProperty(sModelPath + "/nodes", [...aQuotations, ...aSupply]);
                this._updateAvisoPhases(sAvisoPath);
            };

            oODataModel.read(`/NotificationHeaderSet('${sNotifNo}')/NotificationQuotationSet`, {
                success: (oData: any) => {
                    const aQuotations = (oData?.results || []).map((quot: any) => {
                        const sRawStatus: string = quot.Status || "Pendiente";
                        const sCleanStatus = sRawStatus.includes("-")
                            ? sRawStatus.substring(sRawStatus.indexOf("-") + 1).trim()
                            : sRawStatus;
                        const bFinal = ["finalizada", "finalizado"].includes(sCleanStatus.toLowerCase());
                        const sAmount = quot.Amount ? `${quot.Amount} ${quot.Currency || ""}`.trim() : "—";
                        return {
                            type: "Cotización",
                            id: quot.Quotation || quot.Vbeln,
                            description: quot.Description || "Cotización de refacción/servicio",
                            date: this._formatDate(quot.Inicio || quot.Erdat),
                            status: sCleanStatus,
                            statusState: bFinal ? "Success" : "Warning",
                            statusIcon: bFinal ? "sap-icon://sys-enter-2" : "sap-icon://message-warning",
                            amount: sAmount,
                            detail: `Importe: ${sAmount}`,
                            nodes: []
                        };
                    });
                    fnSetChildren(aQuotations);
                },
                error: (oError: any) => {
                    console.error("Error al cargar las cotizaciones:", oError);
                    fnSetChildren([]);
                }
            });
        }
    }

    // =====================================================================
    // NODOS DE LIBERACIÓN Y MRP (SIMULADOS)
    // En productivo: reemplazar por la lectura de OrderSupplySet de la orden.
    // =====================================================================
    private _buildSupplyNodes(oOrder: any, aQuotations: any[]): any[] {
        const bFinalAuth = aQuotations.some((q) => q.statusState === "Success");
        const bReleased = MOCK_FORCE_RELEASE || bFinalAuth;
        const seed = parseInt(String(oOrder.id).replace(/\D/g, "").slice(-3), 10) || 0;
        const ctx = {
            orderId: oOrder.id,
            seed,
            resNo: `00${1000000 + seed}`,
            fromSloc: "Alm. General 1000",
            toSloc: "Satélite S02"
        };

        const oRelease = {
            type: "Liberación",
            id: oOrder.id,
            description: bReleased ? "Orden liberada (LIB)" : "En espera de autorización final",
            detail: bReleased
                ? `Aut. final: Tesorería · Oferta ${aQuotations[0]?.id || "—"}`
                : "Se libera automáticamente al recibir la autorización de Tesorería",
            date: bReleased ? this._today() : "",
            status: bReleased ? "Liberada" : "Pendiente Tesorería",
            statusState: bReleased ? "Success" : "Warning",
            statusIcon: bReleased ? "sap-icon://unlocked" : "sap-icon://locked",
            released: bReleased,
            nodes: []
        };

        if (!bReleased) {
            const oWaiting = {
                type: "Requerimiento MRP",
                id: ctx.resNo,
                description: "Necesidades para almacén satélite",
                detail: "Se generará al liberar la orden",
                date: "",
                status: "En espera de liberación",
                statusState: "None",
                statusIcon: "sap-icon://lateness",
                mrpState: "WAITING",
                coverage: 0,
                coverageText: "",
                mrpMessage: "La orden aún no está liberada; las reservas no son relevantes para MRP.",
                raw: ctx,
                nodes: []
            };
            return [oRelease, oWaiting];
        }

        const scenario = MOCK_SCENARIO !== "AUTO"
            ? MOCK_SCENARIO
            : (["ALL_AVAILABLE", "PENDING_RUN", "MIXED"] as const)[seed % 3];
        const aCodes: SupplyCode[] =
            scenario === "ALL_AVAILABLE" ? ["AVAILABLE", "AVAILABLE", "AVAILABLE"] :
            scenario === "PENDING_RUN"   ? ["PEND_MRP", "PEND_MRP", "PEND_MRP"] :
                                           ["AVAILABLE", "IN_TRANSIT", "NO_STOCK"];

        const aComponents = MOCK_COMPONENTS.map((c, idx) =>
            this._buildComponentNode({ ...c, idx }, aCodes[idx], ctx));

        const oMrp = {
            type: "Requerimiento MRP",
            id: ctx.resNo,
            description: "Necesidades para almacén satélite",
            date: this._today(),
            raw: ctx,
            ...this._mrpSummary(aComponents, ctx),
            nodes: aComponents
        };
        return [oRelease, oMrp];
    }

    private _buildComponentNode(c: any, code: SupplyCode, ctx: any): any {
        const st = SUPPLY_STATUS[code];
        const pad = String(ctx.seed).padStart(3, "0");
        const sSto = `45000${pad}${c.idx + 1}`;
        const sPr = `10004${pad}${c.idx + 1}`;

        let docType = "Ped. traslado", docNo = sSto;
        if (code === "PEND_MRP") { docType = "Reserva"; docNo = ctx.resNo; }
        if (code === "NO_STOCK") { docType = "SolPed"; docNo = sPr; }

        return {
            type: "Material",
            id: c.matnr,
            description: c.maktx,
            qty: c.qty,
            uom: c.uom,
            fromSloc: ctx.fromSloc,
            toSloc: ctx.toSloc,
            docType,
            docNo,
            detail: `${c.qty} ${c.uom} · ${ctx.fromSloc} → ${ctx.toSloc} · ${docType} ${docNo}`,
            date: this._today(),
            status: st.text,
            statusState: st.state,
            statusIcon: st.icon,
            statusCode: code,
            steps: this._buildSteps(code, ctx.resNo, sSto, sPr),
            raw: c,
            nodes: []
        };
    }

    /** Recorrido del material: reserva → MRP → 351 → 101 → 261 */
    private _buildSteps(code: SupplyCode, sRes: string, sSto: string, sPr: string): any[] {
        const bNoStock = code === "NO_STOCK";
        const aDefs = [
            { step: "Reserva creada al liberar la orden", doc: `Reserva ${sRes}` },
            bNoStock
                ? { step: "MRP: sin stock en almacén general → Solicitud de pedido", doc: `SolPed ${sPr}` }
                : { step: "MRP: traslado planificado al satélite", doc: `Ped. traslado ${sSto}` },
            { step: "Salida de almacén general (351)", doc: "" },
            { step: "Entrada en almacén satélite (101)", doc: "" },
            { step: "Consumo en la orden (261)", doc: "" }
        ];
        const reached = SUPPLY_STATUS[code].reached;

        return aDefs.map((d, i) => {
            let state = "None", icon = "sap-icon://circle-task", info = "Pendiente";
            if (i < reached) {
                state = "Success"; icon = "sap-icon://sys-enter-2"; info = this._today();
            } else if (i === reached) {
                state = bNoStock ? "Error" : "Warning";
                icon = bNoStock ? "sap-icon://error" : "sap-icon://pending";
                info = bNoStock ? "Sin cobertura" : "En curso";
            }
            const bShowDoc = i < reached || (bNoStock && i === 1);
            return { step: d.step, doc: bShowDoc ? d.doc : "", info, state, icon };
        });
    }

    private _mrpSummary(aComponents: any[], ctx: any): any {
        const total = aComponents.length;
        const avail = aComponents.filter((c) => c.statusCode === "AVAILABLE").length;
        const hasShortage = aComponents.some((c) => c.statusCode === "NO_STOCK");
        const pendingRun = aComponents.every((c) => c.statusCode === "PEND_MRP");
        const allAvailable = avail === total;
        const detail = `Reserva ${ctx.resNo} · ${ctx.fromSloc} → ${ctx.toSloc} · ${total} materiales`;

        if (pendingRun) {
            return {
                detail, mrpState: "PENDING_RUN", hasShortage: false, allAvailable: false,
                status: "Pendiente correr MRP", statusState: "Warning", statusIcon: "sap-icon://pending",
                coverage: 0, coverageText: "MRP pendiente",
                mrpMessage: "La orden está liberada y sus reservas ya son relevantes para MRP, pero todavía no se planifica el abastecimiento al almacén satélite."
            };
        }

        let status = "En abastecimiento", state = "Information", icon = "sap-icon://shipping-status";
        let msg = "MRP ejecutado. Hay traslados en curso desde el almacén general.";
        if (hasShortage) {
            status = "Con faltantes"; state = "Error"; icon = "sap-icon://error";
            msg = "Al menos un material no tiene stock en el almacén general: se generó una solicitud de pedido a Compras.";
        } else if (allAvailable) {
            status = "Cubierto"; state = "Success"; icon = "sap-icon://sys-enter-2";
            msg = "Todos los materiales están disponibles en el almacén satélite. La orden puede ejecutarse.";
        }
        return {
            detail, mrpState: "PLANNED", hasShortage, allAvailable,
            status, statusState: state, statusIcon: icon,
            coverage: Math.round((avail / total) * 100),
            coverageText: `${avail}/${total} en satélite`,
            mrpMessage: msg
        };
    }

    /** Botón "Correr MRP" (simulado). En productivo: function import, p. ej. /RunMrpForOrder */
    public onRunMrp(oEvent: Event): void {
        const oContext = (oEvent.getSource() as Button).getBindingContext() as Context;
        if (!oContext) {
            return;
        }
        const oViewModel = this.getView()?.getModel() as JSONModel;
        const sPath = oContext.getPath();
        const oMrp = oContext.getObject() as any;
        const oTable = this.byId("treeTable") as any;

        oTable.setBusy(true);
        setTimeout(() => {
            const aLast = oMrp.nodes.length - 1;
            const aComponents = oMrp.nodes.map((c: any, i: number) =>
                this._buildComponentNode(
                    c.raw,
                    c.statusCode === "PEND_MRP" ? (i === aLast ? "NO_STOCK" : "PLANNED") : c.statusCode,
                    oMrp.raw
                ));
            oViewModel.setProperty(sPath, {
                ...oMrp,
                ...this._mrpSummary(aComponents, oMrp.raw),
                nodes: aComponents
            });
            this._updateAvisoPhases(this._parentPath(this._parentPath(sPath)));
            oTable.setBusy(false);
            MessageToast.show(`MRP ejecutado (simulado) para la orden ${oMrp.raw.orderId}`);
        }, 900);
    }

    // =====================================================================
    // COLUMNA "CICLO" (fases del aviso)
    // =====================================================================
    private _buildPhases(oStates: Partial<Record<string, PhaseState>>): any[] {
        return PHASES.map((name) => {
            const state: PhaseState = oStates[name] || "pending";
            const ui = PHASE_UI[state];
            return { name, state, icon: ui.icon, color: ui.color, tooltip: `${name}: ${ui.label}` };
        });
    }

    private _updateAvisoPhases(sAvisoPath: string): void {
        const oViewModel = this.getView()?.getModel() as JSONModel;
        const oAviso = oViewModel?.getProperty(sAvisoPath);
        if (!oAviso) {
            return;
        }

        const aOrders = (oAviso.nodes || []).filter((n: any) => n.type === "Orden de Manto");
        const st: Record<string, PhaseState> = {
            Aviso: "done",
            Orden: aOrders.length ? "done" : "current"
        };

        const aChildren = (aOrders[0]?.nodes || []).filter((n: any) => n.type !== "Loading");
        if (aChildren.length) {
            const aQuots = aChildren.filter((n: any) => n.type === "Cotización");
            const oRel = aChildren.find((n: any) => n.type === "Liberación");
            const oMrp = aChildren.find((n: any) => n.type === "Requerimiento MRP");

            st.Oferta = aQuots.some((q: any) => q.statusState === "Success") || oRel?.released ? "done" : "current";
            if (oRel) {
                st["Liberación"] = oRel.released ? "done" : (aQuots.length ? "current" : "pending");
            }
            if (oMrp) {
                st.MRP = oMrp.mrpState === "PENDING_RUN" ? "current" : (oMrp.mrpState === "PLANNED" ? "done" : "pending");
                st.Abasto = oMrp.mrpState !== "PLANNED" ? "pending"
                    : oMrp.hasShortage ? "blocked"
                    : oMrp.allAvailable ? "done" : "current";
            }
        }
        oViewModel.setProperty(sAvisoPath + "/phases", this._buildPhases(st));
    }

    // =====================================================================
    // FORMATTERS Y UTILERÍAS
    // =====================================================================
    public formatTypeIcon(sType: string): string {
        switch (sType) {
            case "Aviso": return "sap-icon://alert";
            case "Orden de Manto": return "sap-icon://eam-work-order";
            case "Cotización": return "sap-icon://request";
            case "Liberación": return "sap-icon://unlocked";
            case "Requerimiento MRP": return "sap-icon://inventory";
            case "Material": return "sap-icon://product";
            case "SCM": return "sap-icon://shipping-status";
            case "Factura": return "sap-icon://payment";
            default: return "sap-icon://process";
        }
    }

    public formatDetailTitle(sType: string): string {
        switch (sType) {
            case "Aviso": return "Detalle del Aviso de Mantenimiento";
            case "Orden de Manto": return "Detalle de la Orden de Mantenimiento";
            case "Cotización": return "Detalle de la Cotización";
            case "Liberación": return "Detalle de la Liberación de la Orden";
            case "Requerimiento MRP": return "Requerimiento MRP / Abastecimiento";
            case "Material": return "Seguimiento del Material";
            case "SCM": return "Detalle de Cadena de Suministro (SCM)";
            case "Factura": return "Detalle de la Factura";
            default: return "Detalle del Proceso";
        }
    }

    /** Unifica fechas: Date de OData (UTC), "yyyyMMdd", "/Date(ms)/" o "yyyy-MM-dd" → dd/MM/yyyy */
    private _formatDate(v: any): string {
        if (!v) {
            return "";
        }
        const pad = (n: number) => String(n).padStart(2, "0");
        const fromUTC = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;

        if (v instanceof Date) {
            return fromUTC(v);
        }
        const s = String(v);
        if (/^\d{8}$/.test(s)) {
            return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
        }
        const ms = s.match(/\/Date\((\d+)\)\//);
        if (ms) {
            return fromUTC(new Date(parseInt(ms[1], 10)));
        }
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) {
            return `${iso[3]}/${iso[2]}/${iso[1]}`;
        }
        return s;
    }

    private _today(): string {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }

    private _parentPath(sPath: string): string {
        return sPath.substring(0, sPath.lastIndexOf("/nodes/"));
    }

    private _loadingNode(sText: string): any {
        return { type: "Loading", id: "", description: sText, date: "", status: "", detail: "" };
    }

    // =====================================================================
    // NAVEGACIÓN AL DETALLE
    // =====================================================================
    public onNavBack(): void {
        (this.byId("navContainer") as NavContainer)?.back();
    }

    public onPressDetail(oEvent: Event): void {
        const oButton = oEvent.getSource() as Button;
        const oContext = oButton.getBindingContext() as Context;
        if (!oContext) {
            return;
        }

        const oData = oContext.getObject() as any;
        const oNavContainer = this.byId("navContainer") as NavContainer;
        const oDetailPage = this.byId("detailPage");
        if (!oDetailPage || !oNavContainer) {
            return;
        }

        oDetailPage.setBindingContext(oContext);
        const oViewModel = this.getView()?.getModel() as JSONModel;
        const sModelPath = oContext.getPath();

        // ---------- CASO A: AVISO ----------
        if (oData?.type === "Aviso") {
            const oODataModel = this.getOwnerComponent()?.getModel("ZCS_GET_NOTIFICATION_SRV") as ODataModel;
            if (oODataModel) {
                (oDetailPage as any).setBusy(true);
                oODataModel.read(`/NotificationHeaderSet('${oData.id}')`, {
                    urlParameters: { "$expand": "NotificationItemsSet,NotificationActivitiesSet,NotificationPartnersSet,NotificationTextSet" },
                    success: (oDetailData: any) => {
                        oViewModel.setProperty(sModelPath + "/items", oDetailData.NotificationItemsSet?.results || []);
                        oViewModel.setProperty(sModelPath + "/activities", oDetailData.NotificationActivitiesSet?.results || []);
                        oViewModel.setProperty(sModelPath + "/partners", oDetailData.NotificationPartnersSet?.results || []);

                        const rawTexts = oDetailData.NotificationTextSet?.results || [];
                        const fullTextString = rawTexts.map((t: any) => t.TextLine || "").join(" ");

                        // 1. Cabecera / nota general
                        const headerData: any = { isPosition: false };
                        const headerPart = fullTextString.split("--- Posición")[0].trim();
                        if (headerPart) {
                            const dateUserMatch = headerPart.match(/\*\s*([\d\.:]+\s+[\d:]+\s+\w+)\s+(.*?)(?=\s*\*|$)/);
                            if (dateUserMatch) {
                                headerData.timestamp = dateUserMatch[1]?.trim() || "";
                                headerData.user = dateUserMatch[2]?.trim() || "";
                            }
                            const grab = (re: RegExp, sDefault: string) => {
                                const m = headerPart.match(re);
                                return m && m[1] ? m[1].trim() : sDefault;
                            };
                            headerData.solicitante = grab(/Sol:\s*(.*?)(?=\s*Puesto:|$)/i, "No especificado");
                            headerData.puesto = grab(/Puesto:\s*(.*?)(?=\s*Email:|$)/i, "No especificado");
                            headerData.email = grab(/Email:\s*(.*?)(?=\s*Tel:|$)/i, "No especificado");
                            headerData.telefono = grab(/Tel:\s*(.*?)(?=\s*Obs:|$)/i, "No especificado");
                            headerData.observaciones = grab(/Obs:\s*(.*)$/i, "Sin observaciones");
                        }

                        // 2. Posiciones
                        const positionMatches = [...fullTextString.matchAll(/---\s*(Posición\s*\d+)\s*---\s*Pieza:\s*(.*?)(?=\s*Falla:|$)\s*Falla:\s*(.*?)(?=\s*Causa:|$)\s*Causa:\s*(.*?)(?=\s*---|$)/gi)];
                        const structuredPositions = positionMatches.map((match: any) => ({
                            isPosition: true,
                            positionTitle: match[1].trim(),
                            pieza: match[2].trim(),
                            falla: match[3].trim(),
                            causa: match[4].trim()
                        }));

                        oViewModel.setProperty(sModelPath + "/texts", rawTexts);
                        oViewModel.setProperty(sModelPath + "/parsedTextBlocks",
                            headerPart ? [headerData, ...structuredPositions] : structuredPositions);
                        (oDetailPage as any).setBusy(false);
                    },
                    error: (oError: any) => {
                        console.error("Error al consultar el detalle del aviso:", oError);
                        (oDetailPage as any).setBusy(false);
                    }
                });
            }
        }

        // ---------- CASO B: ORDEN ----------
        else if (oData?.type === "Orden de Manto") {
            const oOrderModel = this.getOwnerComponent()?.getModel("ZCS_GET_WORKORDER_SRV") as ODataModel;
            if (oOrderModel) {
                (oDetailPage as any).setBusy(true);
                oOrderModel.read(`/WorkOrderHeaderSet('${oData.id}')`, {
                    urlParameters: { "$expand": "ToOperations,ToPartners,ToComponents" },
                    success: (oDetailData: any) => {
                        oViewModel.setProperty(sModelPath + "/operations", oDetailData.ToOperations?.results || []);
                        oViewModel.setProperty(sModelPath + "/components", oDetailData.ToComponents?.results || []);
                        oViewModel.setProperty(sModelPath + "/partners", oDetailData.ToPartners?.results || []);
                        oViewModel.setProperty(sModelPath + "/description", oDetailData.ShortText || "");
                        oViewModel.setProperty(sModelPath + "/status", oDetailData.SysStatus || "");
                        oViewModel.setProperty(sModelPath + "/equipment", oDetailData.Equipment || "");
                        oViewModel.setProperty(sModelPath + "/plant", oDetailData.Plant || "");
                        oViewModel.setProperty(sModelPath + "/orderId", oDetailData.Orderid || "");
                        (oDetailPage as any).setBusy(false);
                    },
                    error: (oError: any) => {
                        console.error("Error al consultar el detalle de la orden:", oError);
                        (oDetailPage as any).setBusy(false);
                    }
                });
            }
        }

        // ---------- CASO C: COTIZACIÓN ----------
        else if (oData?.type === "Cotización") {
            const oQuotationModel = this.getOwnerComponent()?.getModel("ZSD_GET_QUOTATION_CUSTOMER_SRV") as ODataModel;
            if (oQuotationModel) {
                (oDetailPage as any).setBusy(true);
                oQuotationModel.read(`/QuotationtHeaderInSet('${oData.id}')`, {
                    urlParameters: { "$expand": "QuotationItemsInSet" },
                    success: (oDetailData: any) => {
                        oViewModel.setProperty(sModelPath + "/items", oDetailData.QuotationItemsInSet?.results || []);
                        oViewModel.setProperty(sModelPath + "/quotationId", oDetailData.Quotation || oDetailData.Vbeln || "");
                        oViewModel.setProperty(sModelPath + "/date", this._formatDate(oDetailData.Inicio || oDetailData.Erdat));
                        oViewModel.setProperty(sModelPath + "/amount", oDetailData.Amount || oDetailData.Netwr || "");
                        oViewModel.setProperty(sModelPath + "/currency", oDetailData.Currency || oDetailData.Waerk || "");
                        oViewModel.setProperty(sModelPath + "/salesOrg", oDetailData.Salesorg || oDetailData.Vkorg || "");
                        (oDetailPage as any).setBusy(false);
                    },
                    error: (oError: any) => {
                        console.error("Error al consultar el detalle de la cotización:", oError);
                        (oDetailPage as any).setBusy(false);
                    }
                });
            }
        }

        // Liberación / Requerimiento MRP / Material: los datos ya están en el nodo, solo se navega.
        oNavContainer.to(oDetailPage.getId());
    }
}
