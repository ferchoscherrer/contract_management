import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import Button from "sap/m/Button";
import Event from "sap/ui/base/Event";
import NavContainer from "sap/m/NavContainer";
import Context from "sap/ui/model/Context";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import CheckBox from "sap/m/CheckBox";

/**
 * @namespace repairplanning.controller
 */
export default class Main extends Controller {

    public onInit(): void {
        // 1. Definir los datos mock de prueba por si el OData falla
        const mockData = {
            notifications: [
                {
                    type: "Aviso",
                    id: "AV-800101",
                    description: "Falla crítica detectada en sistema hidráulico principal",
                    date: "2026-08-01",
                    status: "Abierto",
                    priority: "Alta",
                    equipment: "EQ-9021",
                    nodes: [
                        {
                            type: "Orden de Manto",
                            id: "ORD-400102",
                            description: "Orden de trabajo para sustitución de válvula",
                            date: "2026-08-02",
                            status: "En Proceso",
                            craft: "Mecánica Industrial",
                            workCenter: "Taller Central",
                            nodes: [
                                {
                                    type: "Cotización",
                                    id: "COT-300103",
                                    description: "Cotización de refacción con proveedor externo",
                                    date: "2026-08-03",
                                    status: "Aprobada",
                                    vendor: "Hydraulics S.A. de C.V.",
                                    amount: "$1,450.00 USD",
                                    nodes: [
                                        {
                                            type: "SCM",
                                            id: "SCM-200104",
                                            description: "Seguimiento de cadena de suministro y entrega",
                                            date: "2026-08-04",
                                            status: "En Tránsito",
                                            trackingNumber: "TRK-9988231",
                                            nodes: [
                                                {
                                                    type: "Factura",
                                                    id: "FAC-100105",
                                                    description: "Facturación y cierre financiero de refacción",
                                                    date: "2026-08-05",
                                                    status: "Pendiente Pago",
                                                    invoiceNum: "INV-2026-889",
                                                    taxCode: "IVA 16%"
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        // 2. Determinar el correo electrónico (Dinámico BTP o respaldo local de pruebas)
        const sUserEmail = (window as any).sap?.ushell?.Container 
            ? (window as any).sap.ushell.Container.getUser().getEmail() 
            : "sapmelmex@melco.com.mx";

        const sUserName = "sapmelmex@melco.com.mx"

        console.log("Usuario detectado para la consulta OData:", sUserName);

        // 3. Obtener el modelo OData configurado desde el Owner Component
        const oODataModel = this.getOwnerComponent()?.getModel("ZCS_GET_NOTIFICATION_SRV") as ODataModel;

        if (oODataModel) {
            // Construir los filtros requeridos por el servicio de forma nativa para BTP
            const aFilters = [
                new Filter("CreatedOn", FilterOperator.GE, "2026-10-01T00:00:00"),
                new Filter("NotifDate", FilterOperator.LE, "2026-12-30T23:59:59")
                //new Filter("Userstatus", FilterOperator.EQ, sUserName)
            ];

            console.log("Enviando filtros mediante objetos nativos de UI5:", aFilters);

            oODataModel.read("/NotificationHeaderSet", {
                filters: aFilters,
                success: (oData: any) => {
                    console.log("¡Conexión OData exitosa! Datos obtenidos:", oData);
                    
                    if (oData && oData.results && oData.results.length > 0) {
                        const formattedData = {
                            notifications: oData.results.map((item: any) => ({
                                type: "Aviso",
                                id: item.NotifNo || item.qmnum,
                                description: item.ShortText || item.qmtxt,
                                date: item.NotifDate || item.erdat,
                                status: item.Userstatus || "Abierto",
                                priority: item.Priority || "Normal",
                                equipment: item.Equipment || "",
                                contract: item.DocNumber || "",
                                posicion: item.ItmNumber || "",
                                circunstance: item.Coding || "",
                                descriptionCircumstance: item.PurchNoC || "",
                                // ¡CLAVE! Pon un nodo temporal para forzar que aparezca la flecha de expansión en la TreeTable
                                nodes: [{ type: "Loading", id: "", description: "Cargando...", date: "", status: "" }] 
                            }))
                        };
                        const oModel = new JSONModel(formattedData);
                        this.getView()?.setModel(oModel);
                    } else {
                        console.log("El OData respondió pero no trajo registros. Cargando datos de prueba...");
                        this._loadMockData(mockData);
                    }
                },
                error: (oError: any) => {
                    console.warn("No se pudo conectar al servicio OData. Usando datos de prueba.", oError);
                    this._loadMockData(mockData);
                }
            });
        } else {
            console.log("Modelo OData no encontrado en el Manifest. Usando datos de prueba.");
            this._loadMockData(mockData);
        }
    }

    private _loadMockData(mockData: any): void {
        const viewModel = new JSONModel(mockData);
        this.getView()?.setModel(viewModel);
    }

    public formatDetailTitle(sType: string): string {
        switch (sType) {
            case "Aviso": return "Detalle del Aviso de Mantenimiento";
            case "Orden de Manto": return "Detalle de la Orden de Mantenimiento";
            case "Cotización": return "Detalle de la Cotización";
            case "SCM": return "Detalle de Cadena de Suministro (SCM)";
            case "Factura": return "Detalle de la Factura";
            default: return "Detalle del Proceso";
        }
    }

    // public onPressDetail(oEvent: Event): void {
    //     const oButton = oEvent.getSource() as Button;
    //     const oContext = oButton.getBindingContext() as Context;
        
    //     if (oContext) {
    //         const oNavContainer = this.byId("navContainer") as NavContainer;
    //         const oDetailPage = this.byId("detailPage");
            
    //         if (oDetailPage && oNavContainer) {
    //             oDetailPage.setBindingContext(oContext);
    //             oNavContainer.to(oDetailPage.getId());
    //         }
    //     }
    // }

    // public onPressDetail(oEvent: Event): void {
    //     const oButton = oEvent.getSource() as Button;
    //     const oContext = oButton.getBindingContext() as Context;
        
    //     if (!oContext) {
    //         return;
    //     }

    //     const oData = oContext.getObject() as any;
    //     const oNavContainer = this.byId("navContainer") as NavContainer;
    //     const oDetailPage = this.byId("detailPage");
        
    //     if (oDetailPage && oNavContainer) {
    //         // Seteamos el contexto a la página de detalle
    //         oDetailPage.setBindingContext(oContext);
            
    //         // Evaluamos la jerarquía: Por el momento, manejamos exclusivamente el detalle del "Aviso"
    //         if (oData && oData.type === "Aviso") {
    //             const sNotifNo = oData.id;
    //             const oODataModel = this.getOwnerComponent()?.getModel("ZCS_GET_NOTIFICATION_SRV") as ODataModel;

    //             if (oODataModel) {
    //                 // Activar indicador visual de carga mientras responde SAP
    //                 (oDetailPage as any).setBusy(true);

    //                 const sPath = `/NotificationHeaderSet('${sNotifNo}')`;
    //                 const sExpand = "NotificationItemsSet,NotificationActivitiesSet,NotificationPartnersSet";

    //                 console.log(`Consultando detalle expandido estilo IW53 para el Aviso: ${sNotifNo}`);

    //                 oODataModel.read(sPath, {
    //                     urlParameters: {
    //                         "$expand": sExpand
    //                     },
    //                     success: (oDetailData: any) => {
    //                         console.log("¡Detalle IW53 del Aviso obtenido con éxito!", oDetailData);

    //                         const oViewModel = this.getView()?.getModel() as JSONModel;
    //                         const sModelPath = oContext.getPath();

    //                         // Inyectar los resultados de los navigation properties al modelo local de la fila
    //                         oViewModel.setProperty(sModelPath + "/items", oDetailData.NotificationItemsSet?.results || []);
    //                         oViewModel.setProperty(sModelPath + "/activities", oDetailData.NotificationActivitiesSet?.results || []);
    //                         oViewModel.setProperty(sModelPath + "/partners", oDetailData.NotificationPartnersSet?.results || []);
    //                         oViewModel.setProperty(sModelPath + "/texts", oDetailData.NotificationTextSet?.results || []);

    //                         (oDetailPage as any).setBusy(false);
    //                     },
    //                     error: (oError: any) => {
    //                         console.error("Error al consultar el detalle expandido del aviso:", oError);
    //                         (oDetailPage as any).setBusy(false);
    //                     }
    //                 });
    //             }
    //         } else if (oData && oData.type === "Orden de Manto") {
    //             // TODO: Aquí puedes implementar la lógica específica para la Orden de Mantenimiento en el futuro
    //             console.log("Seleccionaste una Orden de Manto. Pendiente de configurar detalle.");
    //         }

    //         // Realizar la navegación hacia la pantalla de detalle
    //         oNavContainer.to(oDetailPage.getId());
    //     }
    // }

    public onNavBack(): void {
        const oNavContainer = this.byId("navContainer") as NavContainer;
        if (oNavContainer) {
            oNavContainer.back();
        }
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
        
        if (oDetailPage && oNavContainer) {
            oDetailPage.setBindingContext(oContext);
            
            // ==========================================
            // CASO A: Detalle del AVISO
            // ==========================================
            if (oData && oData.type === "Aviso") {
                const sNotifNo = oData.id;
                const oODataModel = this.getOwnerComponent()?.getModel("ZCS_GET_NOTIFICATION_SRV") as ODataModel;

                if (oODataModel) {
                    (oDetailPage as any).setBusy(true);
                    const sPath = `/NotificationHeaderSet('${sNotifNo}')`;
                    const sExpand = "NotificationItemsSet,NotificationActivitiesSet,NotificationPartnersSet,NotificationTextSet";

                    oODataModel.read(sPath, {
                        urlParameters: { "$expand": sExpand },
                        success: (oDetailData: any) => {
    const oViewModel = this.getView()?.getModel() as JSONModel;
    const sModelPath = oContext.getPath();

    oViewModel.setProperty(sModelPath + "/items", oDetailData.NotificationItemsSet?.results || []);
    oViewModel.setProperty(sModelPath + "/activities", oDetailData.NotificationActivitiesSet?.results || []);
    oViewModel.setProperty(sModelPath + "/partners", oDetailData.NotificationPartnersSet?.results || []);

    const rawTexts = oDetailData.NotificationTextSet?.results || [];
    const fullTextString = rawTexts.map((t: any) => t.TextLine || "").join(" ");

    // ==========================================
    // 1. PARSING DE LA CABECERA / NOTA GENERAL
    // ==========================================
    let headerData: any = { isPosition: false };
    
    const headerPart = fullTextString.split("--- Posición")[0].trim();
    if (headerPart) {
        // Extraer Fecha y Usuario (ej: * 26.10.2026 10:03:43 CSTNO USER_BTP)
        const dateUserMatch = headerPart.match(/\*\s*([\d\.:]+\s+[\d:]+\s+\w+)\s+(.*?)(?=\s*\*|$)/);
        if (dateUserMatch) {
            headerData.timestamp = dateUserMatch[1]?.trim() || "";
            headerData.user = dateUserMatch[2]?.trim() || "";
        }

        // Extraer Solicitante (Sol:) -> Corrección aquí: usar [1] en lugar de .get(1)
        const solMatch = headerPart.match(/Sol:\s*(.*?)(?=\s*Puesto:|$)/i);
        headerData.solicitante = (solMatch && solMatch[1]) ? solMatch[1].trim() : "No especificado";

        // Extraer Puesto (Puesto:)
        const puestoMatch = headerPart.match(/Puesto:\s*(.*?)(?=\s*Email:|$)/i);
        headerData.puesto = (puestoMatch && puestoMatch[1]) ? puestoMatch[1].trim() : "No especificado";

        // Extraer Email (Email:)
        const emailMatch = headerPart.match(/Email:\s*(.*?)(?=\s*Tel:|$)/i);
        headerData.email = (emailMatch && emailMatch[1]) ? emailMatch[1].trim() : "No especificado";

        // Extraer Teléfono (Tel:)
        const telMatch = headerPart.match(/Tel:\s*(.*?)(?=\s*Obs:|$)/i);
        headerData.telefono = (telMatch && telMatch[1]) ? telMatch[1].trim() : "No especificado";

        // Extraer Observaciones (Obs:)
        const obsMatch = headerPart.match(/Obs:\s*(.*)$/i);
        headerData.observaciones = (obsMatch && obsMatch[1]) ? obsMatch[1].trim() : "Sin observaciones";
    }

    // ==========================================
    // 2. PARSING DE LAS POSICIONES
    // ==========================================
    const positionMatches = [...fullTextString.matchAll(/---\s*(Posición\s*\d+)\s*---\s*Pieza:\s*(.*?)(?=\s*Falla:|$)\s*Falla:\s*(.*?)(?=\s*Causa:|$)\s*Causa:\s*(.*?)(?=\s*---|$)/gi)];
    
    let structuredPositions = positionMatches.map(match => ({
        isPosition: true,
        positionTitle: match[1].trim(),
        pieza: match[2].trim(),
        falla: match[3].trim(),
        causa: match[4].trim()
    }));

    // Combinamos la cabecera estructurada y las posiciones
    const finalParsedTexts = headerPart ? [headerData, ...structuredPositions] : structuredPositions;

    oViewModel.setProperty(sModelPath + "/texts", rawTexts);
    oViewModel.setProperty(sModelPath + "/parsedTextBlocks", finalParsedTexts);

    (oDetailPage as any).setBusy(false);
},
                        error: (oError: any) => {
                            console.error("Error al consultar el detalle expandido del aviso:", oError);
                            (oDetailPage as any).setBusy(false);
                        }
                    });
                }
            } 
            // ==========================================
            // CASO B: Detalle de la ORDEN DE MANTO
            // ==========================================
            else if (oData && oData.type === "Orden de Manto") {
                const sOrderId = oData.id;
                const oOrderModel = this.getOwnerComponent()?.getModel("ZCS_GET_WORKORDER_SRV") as ODataModel;

                if (oOrderModel) {
                    (oDetailPage as any).setBusy(true);
                    const sPath = `/WorkOrderHeaderSet('${sOrderId}')`;
                    const sExpand = "ToOperations,ToPartners,ToComponents";

                    console.log(`Consultando detalle completo de la orden en ZCS_GET_WORKORDER_SRV: ${sOrderId}`);

                    oOrderModel.read(sPath, {
                        urlParameters: { "$expand": sExpand },
                        success: (oDetailData: any) => {
                            console.log("¡Respuesta completa del header y expansiones de la orden:", oDetailData);

                            const oViewModel = this.getView()?.getModel() as JSONModel;
                            const sModelPath = oContext.getPath();

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
            // ==========================================
            // CASO C: Detalle de la COTIZACIÓN / OFERTA
            // ==========================================
            else if (oData && oData.type === "Cotización") {
                const sQuotationId = oData.id;
                // Nota: Asegúrate de usar el nombre del modelo OData configurado en tu manifest.json para las cotizaciones
                const oQuotationModel = this.getOwnerComponent()?.getModel("ZSD_GET_QUOTATION_CUSTOMER_SRV") as ODataModel;

                if (oQuotationModel) {
                    (oDetailPage as any).setBusy(true);
                    const sPath = `/QuotationtHeaderInSet('${sQuotationId}')`;
                    const sExpand = "QuotationItemsInSet"; // Nombre de tu navigation property de posiciones en la SEGW

                    console.log(`Consultando detalle completo de la cotización: ${sQuotationId}`);

                    oQuotationModel.read(sPath, {
                        urlParameters: { "$expand": sExpand },
                        success: (oDetailData: any) => {
                            console.log("¡Respuesta completa de la cotización:", oDetailData);

                            const oViewModel = this.getView()?.getModel() as JSONModel;
                            const sModelPath = oContext.getPath();

                            // 1. Inyectamos las posiciones hijas de la cotización (Tabla VBAP)
                            oViewModel.setProperty(sModelPath + "/items", oDetailData.QuotationItemsInSet?.results || []);

                            // 2. Inyectamos los campos de la cabecera (VBAK)
                            oViewModel.setProperty(sModelPath + "/quotationId", oDetailData.Quotation || oDetailData.Vbeln || "");
                            oViewModel.setProperty(sModelPath + "/date", oDetailData.Inicio || oDetailData.Erdat || "");
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

            oNavContainer.to(oDetailPage.getId());
        }
    }

    /*
    public onToggleOpenState(oEvent: any): void {
        console.log("=== EL EVENTO TOGGLE OPEN STATE HA SIDO INVOCADO ===");
        
        const bExpanded = oEvent.getParameter("expanded");
        const oRowContext = oEvent.getParameter("rowContext");
        
        if (!bExpanded || !oRowContext) {
            return;
        }

        const oNodeData = oRowContext.getObject();
        
        // Verificamos si es un Aviso y si el primer nodo es el temporal de carga
        if (oNodeData.type === "Aviso") {
            const sNotifNo = oNodeData.id; 
            const oODataModel = this.getOwnerComponent()?.getModel("ZCS_GET_NOTIFICATION_SRV") as ODataModel;

            if (oODataModel) {
                const sPath = `/NotificationHeaderSet('${sNotifNo}')/NotificationOrderSet`;

                console.log(`Cargando órdenes hijas para la ruta: ${sPath}`);

                oODataModel.read(sPath, {
                    success: (oData: any) => {
                        console.log("Órdenes hijas obtenidas con éxito:", oData);

                        if (oData && oData.results) {
                            const aOrders = oData.results.map((order: any) => ({
                                type: "Orden de Manto",
                                id: order.OrderId || order.Aufnr,
                                description: order.Texto || order.Ktext || "Orden de Mantenimiento",
                                date: order.Inicio || order.Gstrp || "",
                                status: "En Proceso",
                                nodes: [] // Las órdenes pueden estar vacías si no tienen más niveles abajo
                            }));

                            const oViewModel = this.getView()?.getModel() as JSONModel;
                            const sModelPath = oRowContext.getPath(); 
                            
                            // Reemplaza el nodo de carga temporal por las órdenes reales de SAP
                            oViewModel.setProperty(sModelPath + "/nodes", aOrders);
                        }
                    },
                    error: (oError: any) => {
                        console.error("Error al cargar las órdenes hijas por OData:", oError);
                    }
                });
            }
        }
    }
    */
  public onToggleOpenState(oEvent: any): void {
        console.log("=== EL EVENTO TOGGLE OPEN STATE HA SIDO INVOCADO ===");
        
        const bExpanded = oEvent.getParameter("expanded");
        const oRowContext = oEvent.getParameter("rowContext");
        
        if (!bExpanded || !oRowContext) {
            return;
        }

        const oNodeData = oRowContext.getObject();
        const oODataModel = this.getOwnerComponent()?.getModel("ZCS_GET_NOTIFICATION_SRV") as ODataModel;

        if (!oODataModel) {
            return;
        }

        // ==========================================
        // CASO 1: Se expande un AVISO -> Carga Órdenes
        // ==========================================
        if (oNodeData.type === "Aviso" && (!oNodeData.nodes || oNodeData.nodes[0]?.type === "Loading")) {
            const sNotifNo = oNodeData.id; 
            const sPath = `/NotificationHeaderSet('${sNotifNo}')/NotificationOrderSet`;

            console.log(`Cargando órdenes hijas para la ruta: ${sPath}`);

            oODataModel.read(sPath, {
                success: (oData: any) => {
                    console.log("Órdenes hijas obtenidas con éxito:", oData);

                    if (oData && oData.results) {
                        const aOrders = oData.results.map((order: any) => ({
                            type: "Orden de Manto",
                            id: order.OrderId || order.Aufnr,
                            description: order.Texto || order.Ktext || "Orden de Mantenimiento",
                            date: order.Inicio || order.Gstrp || "",
                            status: "En Proceso",    //. hay q cambiar este valor para traer el status correcto de. la orden, por el momento se queda fijo.
                            parentNotifNo: sNotifNo, // <-- ¡CLAVE! Guardamos el Aviso padre para usarlo en niveles inferiores
                            nodes: [{ type: "Loading", id: "", description: "Cargando cotizaciones...", date: "", status: "" }] 
                        }));

                        const oViewModel = this.getView()?.getModel() as JSONModel;
                        const sModelPath = oRowContext.getPath(); 
                        oViewModel.setProperty(sModelPath + "/nodes", aOrders);
                    }
                },
                error: (oError: any) => {
                    console.error("Error al cargar las órdenes hijas por OData:", oError);
                }
            });
        }
        
        // ==========================================
        // CASO 2: Se expande una ORDEN -> Carga Cotizaciones pasando por el Aviso Padre
        // ==========================================
        else if (oNodeData.type === "Orden de Manto" && (!oNodeData.nodes || oNodeData.nodes[0]?.type === "Loading")) {
            const sNotifNo = oNodeData.parentNotifNo; // Recuperamos el Aviso padre guardado en el nivel anterior
            const sOrderId = oNodeData.id; 
            
            // Ruta completa respetando la entrada obligatoria por el NotificationHeaderSet
            const sPath = `/NotificationHeaderSet('${sNotifNo}')/NotificationQuotationSet`;

            console.log(`Cargando cotizaciones hijas para la ruta completa: ${sPath}`);

            oODataModel.read(sPath, {
                success: (oData: any) => {
                    console.log("Cotizaciones hijas obtenidas con éxito:", oData);

                    if (oData && oData.results) {
                        const aQuotations = oData.results.map((quot: any) => {
                            
                            // 1. Limpiar el status (quitar el código y el guion)
                            let sRawStatus = quot.Status || "Pendiente";
                            let sCleanStatus = sRawStatus;

                            if (sRawStatus.includes("-")) {
                                sCleanStatus = sRawStatus.substring(sRawStatus.indexOf("-") + 1).trim();
                            }

                            // 2. Lógica de color (State) e Ícono
                            // Por defecto lo ponemos en Warning
                            let sState = "Warning"; 
                            let sIcon = "sap-icon://message-warning"; // Ícono de advertencia

                            // Si dice "Finalizada" (ignorando mayúsculas/minúsculas), cambiamos a Success (Verde)
                            if (sCleanStatus.toLowerCase() === "finalizada" || sCleanStatus.toLowerCase() === "finalizado") {
                                sState = "Success"; 
                                sIcon = "sap-icon://sys-enter-2"; // Ícono de check/éxito
                            }

                            return {
                                type: "Cotización",
                                id: quot.Quotation || quot.Vbeln,
                                description: quot.Description || "Cotización de refacción/servicio",
                                date: quot.Inicio || quot.Erdat || "",
                                status: sCleanStatus,
                                statusState: sState, // Nueva propiedad para el color
                                statusIcon: sIcon,   // Nueva propiedad para el ícono
                                amount: quot.Amount || "",
                                nodes: []
                            };
                        });

                        const oViewModel = this.getView()?.getModel() as JSONModel;
                        const sModelPath = oRowContext.getPath(); 
                        oViewModel.setProperty(sModelPath + "/nodes", aQuotations);
                    }
                },
                error: (oError: any) => {
                    console.error("Error al cargar las cotizaciones por OData:", oError);
                }
            });
        }
    }
}