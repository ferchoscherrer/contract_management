import Controller from "sap/ui/core/mvc/Controller";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Router from "sap/ui/core/routing/Router";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import ContextV2 from "sap/ui/model/odata/v2/Context";
import { Customer, DetailRouteArg, ItemEquipment, RoutingEquipment, WorkForce, WorkForce_Service } from "../model/types";
import { Route$MatchedEvent } from "sap/ui/core/routing/Route";
import Input, { Input$ValueHelpRequestEvent } from "sap/m/Input";
import { TableSelectDialog$ConfirmEvent, TableSelectDialog$SearchEvent } from "sap/m/TableSelectDialog";
import Dialog from "sap/m/Dialog";
import Fragment from "sap/ui/core/Fragment";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ODataListBinding from "sap/ui/model/odata/v2/ODataListBinding";
import { Button$PressEvent } from "sap/m/Button";
import Target, { Target$DisplayEvent } from "sap/ui/core/routing/Target";
import Table, { Table$RowSelectionChangeEvent } from "sap/ui/table/Table";
import MessageBox from "sap/m/MessageBox";
import BusyIndicator from "sap/ui/core/BusyIndicator";
import ERP from "contractmanagement/contractmanagement/modules/ERP";
import formatter from "contractmanagement/contractmanagement/model/formatter";
import MessageToast from "sap/m/MessageToast";


import { BOMItem } from "../model/types";

/**
 * @namespace contractmanagement.contractmanagement.controller
 */
export default class Equipment extends Controller {
    private oContractManagement: JSONModel;
    private oI18nModel: ResourceModel;
    private oI18n: ResourceBundle;
    private oRouter: Router;
    private oTarget: Target;
    private oInfoMaterial: RoutingEquipment | undefined;

    private oFragmentEquipment: Dialog;
    private oFragmentCup:  Dialog;
    private sPahtEquipement: string;
    private arrIndexSelectRow: number[] = [];
    private fTopeDescuento: number = 0;

    // --- INICIO CÓDIGO NUEVO (Propiedades) ---
    private oFragmentBOM: Dialog; // Referencia al nuevo fragmento
    private ZCS_GET_BOM_MATERIAL_SRV: ODataModel; // Nuevo Modelo OData
    private ZCS_GET_DETERMINATION_SRV: ODataModel;
    private sCurrentEquipmentID: string; // Para guardar el ID del equipo actual
    // --- FIN CÓDIGO NUEVO ---

    
    private ZCS_GET_COST_MAINTAIN_SRV: ODataModel;

    public formatter = formatter;

    /*eslint-disable @typescript-eslint/no-empty-function*/
  public onInit(): void {
    this.oContractManagement = this.getOwnerComponent()?.getModel("mContractManagement") as JSONModel;
    this.oI18nModel = this.getOwnerComponent()?.getModel("i18n") as ResourceModel;
    this.oI18n = this.oI18nModel.getResourceBundle() as ResourceBundle;
    this.oRouter = (this.getOwnerComponent() as UIComponent).getRouter();
    this.ZCS_GET_COST_MAINTAIN_SRV = this.getOwnerComponent()?.getModel("ZCS_GET_COST_MAINTAIN_SRV") as ODataModel;
    this.ZCS_GET_BOM_MATERIAL_SRV = this.getOwnerComponent()?.getModel("ZCS_GET_BOM_MATERIAL_SRV") as ODataModel;
    this.ZCS_GET_DETERMINATION_SRV = this.getOwnerComponent()?.getModel("ZCS_GET_DETERMINATION_SRV") as ODataModel;

    this.oTarget = this.oRouter.getTarget("TargetEquipment") as Target;
    this.oTarget.attachDisplay((oEvent: Target$DisplayEvent) => {
        this.oInfoMaterial = oEvent.getParameter("data") as RoutingEquipment;
        console.log("=== TargetEquipment.attachDisplay ===");
        console.log("Data recibida en navegación:", this.oInfoMaterial);
    });
}


    public onValidateNumber(oEvent: any): void {
        const oInput = oEvent.getSource();
        let sValue = oEvent.getParameter("value");

        // 1. Eliminar cualquier caracter que no sea número o punto
        // Nota: Permitimos comas si tu formato usa comas, aquí asumo formato estándar (1234.56)
        // Si usas puntos para decimales, usa esta regex: /[^0-9.]/g
        let sNewValue = sValue.replace(/[^0-9.,]/g, "");

        // 2. Si el valor cambió (porque había letras), actualizamos el input
        if (sValue !== sNewValue) {
            oInput.setValue(sNewValue);
        }
    }

    public onNavBack(): void {
    if (this.oInfoMaterial?.fromTarget) {
        const arrIDMaterialPos = this.oInfoMaterial?.materialPositions as number[];
        const arrEquipment: ItemEquipment[] = this.oContractManagement.getProperty('/arrEquipment');
        
        // Calculamos el total de los equipos asignados actualmente
        let iTotalCUP: number = 0;
        arrEquipment.forEach(oEquiment => iTotalCUP += Number(oEquiment.cup || 0));

        for (const iPosition of arrIDMaterialPos) {
            // CAMBIO: Solo sobreescribimos el netValue si el cálculo del equipo es mayor a 0
            // Si iTotalCUP es 0 (porque solo asignaste el equipo pero no abriste el CUP),
            // mantenemos el valor que ya tenía la fila (el valor clonado).
            if (iTotalCUP > 0) {
                this.oContractManagement.setProperty(`/arrMaterial/${iPosition}/netValue`, iTotalCUP);
            }
        }

        this.oContractManagement.setProperty('/arrEquipment', []);
        this.oRouter.getTargets()?.display(this.oInfoMaterial.fromTarget);
        this.oContractManagement.setProperty('/oConfig/isEdiatbleEquipment', true);
        BusyIndicator.hide();
    }
}

    public async onOpenPopUpEquipment(oEvent : Input$ValueHelpRequestEvent): Promise<void> {

        this.onGetPathEquipement(oEvent);

        const oRequester : Customer = this.oContractManagement.getProperty(`/header/oRequester`);
        const oFilter = new Filter({
            filters: [
                new Filter('Partner', FilterOperator.EQ, oRequester.CustomerCode)
            ]
        });

        this.oFragmentEquipment ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblEquipment",
            controller: this,
        }) as Dialog;

        this.getView()?.addDependent(this.oFragmentEquipment);

        const oBinding = this.oFragmentEquipment.getBinding("items") as ODataListBinding;
        oBinding.filter(oFilter);

        this.oFragmentEquipment.open();
    }

    private onGetPathEquipement(oEvent : Input$ValueHelpRequestEvent) {
        const oSource : Input = oEvent.getSource();
        const oBindingContext = oSource.getBindingContext("mContractManagement") as ContextV2;
        this.sPahtEquipement = oBindingContext.getPath();
    }

    public onSearchEquipment(oEvent: TableSelectDialog$SearchEvent): void {

        let sValue: string = oEvent.getParameter("value") || "";
        let oFilter = new Filter({
            filters: [
                new Filter("Reason", FilterOperator.Contains, sValue),
                new Filter("Description", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        let oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    // se comenta para agregar nueva
  /*  public onSelectEquipment(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];

        if (this.sPahtEquipement)
            for(const oSelect of oSelectedContext){
                this.oContractManagement.setProperty(`${this.sPahtEquipement}`, oSelect.getObject());
                
            }
    }
    */
   /*
   public onSelectEquipment(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];

        if (this.sPahtEquipement) {
            for(const oSelect of oSelectedContext){
                // CORRECCIÓN: Asignar el tipo 'ItemEquipment' al objeto recuperado
                //const oEquipmentObj = oSelect.getObject() as ItemEquipment;
                const oEquipmentObj = oSelect.getObject() as any;
                
                this.oContractManagement.setProperty(`${this.sPahtEquipement}`, oEquipmentObj);
                const sMaterialDelItem = oEquipmentObj.Material || oEquipmentObj.Matnr || "";

                // Ahora TypeScript ya sabe que existe .EquipmentB
                if (oEquipmentObj.EquipmentB) {
                    this.onCheckBOM(oEquipmentObj.EquipmentB, sMaterialDelItem);
                }
            }
        }
    } */

/*
        // inicio - cambio de funcion para validar si existe ya un documento de venta con el equipo

        public onSelectEquipment(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];

        // 1. Recuperamos el Material desde el Modelo Principal (Main)
        // Usamos la información de navegación para saber qué posición se está editando
        let sMaterialDelMain = "";
        
        if (this.oInfoMaterial && this.oInfoMaterial.materialPositions && this.oInfoMaterial.materialPositions.length > 0) {
            // Tomamos el índice de la primera posición seleccionada en el Main
            const iIndexPosition = this.oInfoMaterial.materialPositions[0];
            
            // Leemos el objeto Material guardado en el modelo mContractManagement
            // Ruta: /arrMaterial/{indice}/oMaterial
            const oMaterialObj = this.oContractManagement.getProperty(`/arrMaterial/${iIndexPosition}/oMaterial`);
            
            if (oMaterialObj) {
                // Asumiendo que la propiedad se llama 'Material' en tu tipo Material
                sMaterialDelMain = oMaterialObj.Material || "";
            }
        }
        
        console.log("Material recuperado del Main:", sMaterialDelMain); // Para depuración

        // 2. Procesamos la selección del equipo
        if (this.sPahtEquipement) {
            for(const oSelect of oSelectedContext){
                const oEquipmentObj = oSelect.getObject() as any; // Cast a any o ItemEquipment
                
                this.oContractManagement.setProperty(`${this.sPahtEquipement}`, oEquipmentObj);

                // 3. Llamamos a onCheckBOM enviando el Material del Main
                if (oEquipmentObj.EquipmentB) {
                    // Pasamos: (ID del Equipo, ID del Material del Contrato)
                    this.onCheckBOM(oEquipmentObj.EquipmentB, sMaterialDelMain);
                }
            }
        }
    }

    // Fin - cambio de funcion para validar si existe ya un documento de venta con el equipo
    */
   
    public async onSelectEquipment(oEvent: TableSelectDialog$ConfirmEvent): Promise<void> {
    const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
    if (!this.sPahtEquipement || oSelectedContext.length === 0) return;

    const oEquipmentObj = oSelectedContext[0].getObject() as any;
    const sEquipmentID = oEquipmentObj.EquipmentB;

    // Llamada al OData para verificar oferta previa
    const bTieneOferta = await this._validarExistenciaOferta(sEquipmentID);

    if (bTieneOferta) {
        MessageBox.warning(
            `Atención: El equipo ${sEquipmentID} ya tiene una oferta N°  registrada en los últimos meses. ¿Desea continuar?`,
            {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: (sAction: string) => {
                    if (sAction === MessageBox.Action.YES) {
                        //this._finalizarAsignacion(oEquipmentObj);
                        this._ejecutarAsignacionFinal(oEquipmentObj);
                    }
                }
            }
        );
    } else {
        //this._finalizarAsignacion(oEquipmentObj);
        this._ejecutarAsignacionFinal(oEquipmentObj);
    }
}
/*
private _finalizarAsignacion(oEquipmentObj: any): void {
    this.oContractManagement.setProperty(`${this.sPahtEquipement}`, oEquipmentObj);
    // ... resto de tu lógica para BOM o materiales
}
*/
private _ejecutarAsignacionFinal(oEquipmentObj: any): void {
    console.log("=== _ejecutarAsignacionFinal ===");
    console.log("Ruta equipo actual:", this.sPahtEquipement);
    console.log("Equipo seleccionado desde popup:", JSON.parse(JSON.stringify(oEquipmentObj)));

    const oCurrentEquipData = this.oContractManagement.getProperty(this.sPahtEquipement);
    console.log("Datos actuales antes de fusionar:", JSON.parse(JSON.stringify(oCurrentEquipData)));

    const oFusedEquipment = {
        ...oEquipmentObj,
        cup: oCurrentEquipData.cup || 0,
        workForce: oCurrentEquipData.workForce || []
    };

    console.log("Equipo fusionado FINAL:", JSON.parse(JSON.stringify(oFusedEquipment)));

    this.oContractManagement.setProperty(this.sPahtEquipement, oFusedEquipment);

    console.log("Equipo guardado en modelo:", JSON.parse(JSON.stringify(
        this.oContractManagement.getProperty(this.sPahtEquipement)
    )));

    let sMaterialDelMain = "";
    if (this.oInfoMaterial && this.oInfoMaterial.materialPositions && this.oInfoMaterial.materialPositions.length > 0) {
        const iIndexPosition = this.oInfoMaterial.materialPositions[0];
        const oMaterialObj = this.oContractManagement.getProperty(`/arrMaterial/${iIndexPosition}/oMaterial`);
        sMaterialDelMain = oMaterialObj ? (oMaterialObj.Material || "") : "";
    }

    console.log("Material tomado del Main para BOM:", sMaterialDelMain);

    if (oEquipmentObj.EquipmentB) {
        this.onCheckBOM(oEquipmentObj.EquipmentB, sMaterialDelMain);
    }
}

    private async _validarExistenciaOferta(sEquipmentID: string): Promise<boolean> {
    try {
        // Construimos el endpoint con la llave del equipo
        // Ejemplo: /ValidarEquipoSet('000000000010001234')
        const sEntity = ERP.generateEntityWithKeys("/ValidaEquiposSet", { 
            Equipo: sEquipmentID 
        });

        const { data } = await ERP.readDataKeysERP(
            sEntity, 
            this.ZCS_GET_COST_MAINTAIN_SRV
        );

        return data.Existe === true || data.Existe === "X";
    } catch (error) {
        console.error("Error al validar equipo:", error);
        return false;
    }
}


public onAddEquipment(oEvent: Button$PressEvent): void {
    try {
        console.log("=== onAddEquipment ===");
        console.log("oInfoMaterial:", this.oInfoMaterial);

        const arrEquipments: ItemEquipment[] = this.oContractManagement.getProperty("/arrEquipment") || [];
        console.log("arrEquipments actual:", arrEquipments);

        const aPos = this.oInfoMaterial?.materialPositions;
        console.log("materialPositions:", aPos);

        if (!aPos || aPos.length === 0) {
            console.error("No hay materialPositions en oInfoMaterial");
            MessageBox.error("No se encontró la posición del material para agregar el equipo.");
            return;
        }

        const iIndex = aPos[0];
        console.log("iIndex detectado:", iIndex);

        const sMaterialPath = `/arrMaterial/${iIndex}`;
        console.log("Ruta material:", sMaterialPath);

        const oMaterialPos = this.oContractManagement.getProperty(sMaterialPath);
        console.log("oMaterialPos:", oMaterialPos);

        if (!oMaterialPos) {
            console.error("No existe la fila del material en la ruta:", sMaterialPath);
            MessageBox.error(`No existe el material en la ruta ${sMaterialPath}`);
            return;
        }

        const oTemp = oMaterialPos?.tempCUP;
        console.log("tempCUP recuperado:", oTemp);

        const oNewEquip: any = {
            EquipmentB: null,
            InstalationDate: null,
            DescriptionE: null,
            Emplaz: null,
            Location: null,
            DescriptionL: null,
            Partner: null,
            cup: oTemp ? oTemp.cup : 0,
            workForce: oTemp ? JSON.parse(JSON.stringify(oTemp.workForce || [])) : []
        };

        console.log("Nuevo equipo a insertar:", oNewEquip);

        arrEquipments.push(oNewEquip);

        console.log("arrEquipments después push:", arrEquipments);

        this.oContractManagement.setProperty("/arrEquipment", arrEquipments);
        this.oContractManagement.refresh(true);

        console.log("Modelo final /arrEquipment:", this.oContractManagement.getProperty("/arrEquipment"));
    } catch (error) {
        console.error("Error en onAddEquipment:", error);
        MessageBox.error("Error al agregar equipo. Revisa la consola.");
    }
}




    public onDeleteEquipment(){

        if (this.arrIndexSelectRow.length === 0) {
            MessageBox.alert(this.oI18n.getText("errorDeleteRows") ?? '')
        } else {
            MessageBox.warning(this.oI18n.getText("warnDeletePosition") || "",{
                actions: [MessageBox.Action.YES, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.YES,
                onClose: (sAction : string ) =>{
                    if (sAction === 'YES') this._onDelete();
                }
            });
        }
        
    }

    private _onDelete(){

        const oTable = this.byId("tblEquipment") as Table;
        const arrEquipment : ItemEquipment[] = this.oContractManagement.getProperty(`/arrEquipment`);
    
        for (const indexRowSelect of this.arrIndexSelectRow){
            arrEquipment.splice(indexRowSelect,this.arrIndexSelectRow.length);   
        }
        this.oContractManagement.refresh(true);
        oTable.clearSelection();
        this.arrIndexSelectRow = [];
    }

    public onSelectRow(oEvent : Table$RowSelectionChangeEvent){
        const oSource : Table = oEvent.getSource();
        const arrSelectedRow : number[] = oSource.getSelectedIndices();

        this.arrIndexSelectRow = arrSelectedRow;
    }

   public onSaveEquipment() {
    BusyIndicator.show(0);
    const arrIDMaterialPos = this.oInfoMaterial?.materialPositions as number[];
    const arrEquipment: ItemEquipment[] = this.oContractManagement.getProperty('/arrEquipment');

    if (arrEquipment.length === 0) {
        MessageBox.information(this.oI18n.getText("errAddEquipment") || '');
    } else {
        for (const iPosition of arrIDMaterialPos) {
            // Inyectamos el arreglo completo
            this.oContractManagement.setProperty(`/arrMaterial/${iPosition}/arrEquipment`, arrEquipment);
            this.oContractManagement.setProperty(`/arrMaterial/${iPosition}/hasEquipment`, true);
            
            // Calculamos el valor final para la tabla del Main
            let iTotalCUP = 0;
            arrEquipment.forEach(e => iTotalCUP += Number(e.cup || 0));
            this.oContractManagement.setProperty(`/arrMaterial/${iPosition}/netValue`, iTotalCUP);
        }
        
        // REFRESH CRÍTICO: Esto hace que el Main "despierte" y vea los nuevos datos
        this.oContractManagement.refresh(true);
        this.onNavBack();
    }
    BusyIndicator.hide();
}





  // 🔧 FIX: Este método se dispara desde un BUTTON, no desde un Input
// Por eso NO debemos usar Input$ValueHelpRequestEvent



public async onOpenPopUpCup(oEvent: any): Promise<void> {
    BusyIndicator.show(0);

    const oSource = oEvent.getSource(); 
    const oBindingContext = oSource.getBindingContext("mContractManagement");

    if (!oBindingContext) {
        BusyIndicator.hide();
        return;
    }

    this.sPahtEquipement = oBindingContext.getPath();
    
    // 1. Obtener y guardar el objeto del equipo actual
    const oCurrentEquipment = this.oContractManagement.getProperty(this.sPahtEquipement);
    this.oContractManagement.setProperty("/currentEquipment", oCurrentEquipment);

    // 2. EXTRAER EL TIPO DE USO QUE VIENE DESDE EL MAIN
    // Usamos el arreglo oInfoMaterial que guardó los índices de las posiciones del Main
    let sUsageTypeDelMain = "";
    if (this.oInfoMaterial && this.oInfoMaterial.materialPositions && this.oInfoMaterial.materialPositions.length > 0) {
        const iIndexPosition = this.oInfoMaterial.materialPositions[0];
        // Leemos directamente la propiedad 'selectedUsageType' asignada en la fila del Main
        sUsageTypeDelMain = this.oContractManagement.getProperty(`/arrMaterial/${iIndexPosition}/selectedUsageType`) || "";
    }

    // 3. Setear el valor de control en el modelo para el Expression Binding del fragmento
    this.oContractManagement.setProperty("/currentEquipmentUsageType", sUsageTypeDelMain);

    console.log("Tipo de uso recuperado del Main para el Fragmento:", sUsageTypeDelMain);

    try {
        await this._onGetWorkForce();

        this.oFragmentCup ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.DialogCup",
            controller: this,
        }) as Dialog;

        this.getView()?.addDependent(this.oFragmentCup);
        this.oFragmentCup.open();
    } catch (oError) {
        console.error("Error al abrir el popup de CUP:", oError);
    } finally {
        BusyIndicator.hide();
    }
}

    //inicio - se comenta funcion para mejorarla
    /*
    private async _onGetWorkForce() : Promise<void> {
        BusyIndicator.show(0)
        try {            
            const { data } = await ERP.readDataKeysERP(
                "/ManoObraSet('53')",
                this.ZCS_GET_COST_MAINTAIN_SRV,
                // arrFilter
            );
            //debugger
            const arrResults : WorkForce[] = [
                {
                    key:'ZCS1',item: "Mano de Obra",annual: data.ValorTotal ,date: new Date(),monthly: (data.ValorTotal/12)
                },
                {
                    key:'ZCS2',item: "Serv trasl/Atn a falla",annual: 0,date: new Date(),monthly: 0
                },
                {
                    key:'ZCS3',item: "Otros materiales y/o inventarios",annual: data.ValorTotal,date: new Date(),monthly: (data.ValorTotal/12)
                },
                {
                    key:'ZCS4',item: "Gastos de operación y venta",annual: 0,date: new Date(),monthly: 0
                },
                {
                    key:'ZCS5',item: "Utilidad",annual: 0,date: new Date(),monthly: 0
                },
                {
                    key:'06',item: "Total",annual: 0,date: new Date(),monthly: 0
                }
            ];
            // data.results; //as Contract_By_Customer_Header[];

            if (arrResults.length <= 0) 
                throw new Error(this.oI18n.getText("noDataWorkForce"));
                           
            this.oContractManagement.setProperty('/arrWorkForce', arrResults);
            this._onCalculateTotalWorkForce();
        } catch (oError: any) {
            this.oContractManagement.setProperty('/arrWorkForce', []);
            MessageBox.error(oError.message)
            // throw new Error(oError.message);
        } finally {
            this.oContractManagement.refresh(true);
            BusyIndicator.hide();
        }
    } 
*/
    //fin - se comenta funcion para mejorarla

    // inicio - funcion mejorada

    /* se actualiza funcion para actualizar el esquema de calculo 
    private async _onGetWorkForce(): Promise<void> {
    BusyIndicator.show(0);
    try {
console.log("=== _onGetWorkForce ===");
console.log("Path recibido:", this.sPahtEquipement);

if (!this.sPahtEquipement) {
    console.error("❌ ERROR: sPahtEquipement está vacío");
    MessageBox.error("No se encontró el equipo seleccionado.");
    return;
}

        const oEquipment = this.oContractManagement.getProperty(this.sPahtEquipement);
        console.log("Equipo recuperado desde modelo:", JSON.parse(JSON.stringify(oEquipment)));

     if (oEquipment.workForce && oEquipment.workForce.length > 0) {

    console.log("El equipo YA tiene workForce local.");

    // 🔥 FIX: Convertir fechas string → Date
    const arrFixedWorkForce = oEquipment.workForce.map((item: any) => {
        return {
            ...item,
            date: item.date ? new Date(item.date) : new Date()
        };
    });

    console.log("WorkForce corregido:", arrFixedWorkForce);

    this.oContractManagement.setProperty('/arrWorkForce', arrFixedWorkForce);

    this._onCalculateTotalWorkForce();

    BusyIndicator.hide();
    return;
}

        const sEquipmentID = oEquipment.EquipmentB;
        console.log("No tenía workForce local. Se consultará servicio para equipo:", sEquipmentID);

        if (!sEquipmentID) {
            throw new Error("No se ha identificado el número de equipo.");
        }

        const { data } = await ERP.readDataKeysERP(`/ManoObraSet('${sEquipmentID}')`, this.ZCS_GET_COST_MAINTAIN_SRV);

        console.log("Respuesta servicio ManoObraSet:", data);

        const arrResults: WorkForce[] = [
            { key:'ZCS1', item: "Mano de Obra", annual: data.ValorTotal, date: new Date(), monthly: (data.ValorTotal/12) },
            { key:'ZCS2', item: "Serv trasl/Atn a falla", annual: 0, date: new Date(), monthly: 0 },
            { key:'ZCS3', item: "Otros materiales y/o inventarios", annual: data.ValorTotal, date: new Date(), monthly: (data.ValorTotal/12) },
            { key:'ZCS4', item: "Gastos de operación y venta", annual: 0, date: new Date(), monthly: 0 },
            { key:'ZCS5', item: "Utilidad", annual: 0, date: new Date(), monthly: 0 },
            { key:'06', item: "Total", annual: 0, date: new Date(), monthly: 0 }
        ];

        console.log("WorkForce armado desde servicio:", JSON.parse(JSON.stringify(arrResults)));

        this.oContractManagement.setProperty('/arrWorkForce', arrResults);
        this._onCalculateTotalWorkForce();

        console.log("arrWorkForce final en popup:", JSON.parse(JSON.stringify(
            this.oContractManagement.getProperty('/arrWorkForce')
        )));

    } catch (oError: any) {
        console.error("Error en _onGetWorkForce:", oError);
        this.oContractManagement.setProperty('/arrWorkForce', []);
        MessageBox.error(oError.message || "Error al obtener datos");
    } finally {
        this.oContractManagement.refresh(true);
        BusyIndicator.hide();
    }
}
*/


// private async _onGetWorkForce(): Promise<void> {
//     BusyIndicator.show(0);
//     try {
//         if (!this.sPahtEquipement) {
//             MessageBox.error("No se encontró el equipo seleccionado.");
//             return;
//         }

//         const oEquipment = this.oContractManagement.getProperty(this.sPahtEquipement);

//         // 1. Si ya tiene workForce local, lo cargamos (esto se mantiene intacto)
//         if (oEquipment.workForce && oEquipment.workForce.length > 0) {
//             const arrFixedWorkForce = oEquipment.workForce.map((item: any) => ({
//                 ...item,
//                 date: item.date ? new Date(item.date) : new Date()
//             }));
//             this.oContractManagement.setProperty('/arrWorkForce', arrFixedWorkForce);
//             this._onCalculateTotalWorkForce();
//             BusyIndicator.hide();
//             return;
//         }

//         // 2. Consulta al NUEVO OData de Determinación
//         const sSerie = oEquipment.EquipmentB; 
//         console.log("Consultando esquema para el equipo (Serie):", sSerie);
//         if (!sSerie) {
//             throw new Error("No se ha identificado el número de equipo para consultar el esquema.");
//         }

//         // Hacemos la llamada usando Promesas con el formato nativo de SAPUI5 
//         // para pasar correctamente los parámetros de navegación ($expand)
//         const oDataResult = await new Promise<any>((resolve, reject) => {
//             this.ZCS_GET_DETERMINATION_SRV.read("/DeterminationHeaderSet", {
//                 filters: [new Filter("Serie", FilterOperator.EQ, sSerie)],
//                 urlParameters: {
//                     "$expand": "DeterminationNivelSet" 
//                 },
//                 success: (oData: any) => resolve(oData),
//                 error: (oError: any) => reject(oError)
//             });
//         });

//         if (!oDataResult || !oDataResult.results || oDataResult.results.length === 0) {
//             throw new Error(`No se encontró el esquema de cálculo para la serie: ${sSerie}`);
//         }

//         // Tomamos el primer registro de la cabecera
//         const oDet = oDataResult.results[0]; 
        
//         // Helper para limpiar espacios y convertir los Edm.String que envía el backend a Floats para la vista
//         const getVal = (val: string) => parseFloat(val ? val.trim() : "0");
//         const calcAnnual = (val: string) => getVal(val) * 12;

//         // =========================================================
//         // LÓGICA NUEVA PARA CALCULAR Z002 (NIVELES)
//         // =========================================================
        
//         // 1. Extraer el número de nivel después del signo "="
//         let iNivelActual = 0;
//         if (oDet.Niveles && oDet.Niveles.includes("=")) {
//             const sValorDespuesIgual = oDet.Niveles.split("=").pop() || "0";
//             iNivelActual = parseInt(sValorDespuesIgual.trim(), 10);
//         }

//         // 2. Buscar en qué rango cae dentro del expand (DeterminationNivelSet)
//         let fPorcentajeNivel = 0;
//         const arrNivelesExpand = oDet.DeterminationNivelSet?.results || [];

//         for (const oRango of arrNivelesExpand) {
//             const iNivelInf = parseInt(oRango.NivelInf, 10);
//             const iNivelSp = parseInt(oRango.NivelSp, 10);

//             // Validamos si nuestro nivel actual está dentro del rango inferior y superior
//             if (iNivelActual >= iNivelInf && iNivelActual <= iNivelSp) {
//                 fPorcentajeNivel = parseFloat(oRango.Porcentaje || "0");
//                 break; // Lo encontramos, dejamos de iterar
//             }
//         }

//         // 3. Calcular el valor mensual para Z002: Monto base * (Porcentaje / 100)
//         const fValorMensualZ002 = getVal(oDet.Monto) * (fPorcentajeNivel / 100);
//         const fValorAnualZ002 = fValorMensualZ002 * 12;

//         // =========================================================
//         // MAPEO A LA TABLA DE LA VISTA
//         // =========================================================
        
//         const arrResults: any[] = [
//             { key: 'Z001', item: "Tipo de Equipo",          serie: oDet.Serie,                     annual: calcAnnual(oDet.Monto),        date: new Date(), monthly: getVal(oDet.Monto) },
//             { key: 'Z002', item: "Niveles del Equipo",      serie: oDet.Niveles || "",             annual: fValorAnualZ002,               date: new Date(), monthly: fValorMensualZ002 }, 
//             { key: 'Z006', item: "Mano de Obra",            serie: "",                             annual: 0,                             date: new Date(), monthly: 0 }, 
//             { key: 'Z007', item: "Insumos",                 serie: "",                             annual: 0,                             date: new Date(), monthly: 0 },
//             { key: 'Z008', item: "Refaccionamiento",        serie: "",                             annual: 0,                             date: new Date(), monthly: 0 },
//             { key: 'Z009', item: "Serv Traslado / Atn Fa",  serie: "",                             annual: calcAnnual(oDet.ServTraslado), date: new Date(), monthly: getVal(oDet.ServTraslado) },
//             { key: 'Z010', item: "Gastos de operacion",     serie: "",                             annual: calcAnnual(oDet.GOP),          date: new Date(), monthly: getVal(oDet.GOP) },
//             { key: 'Z011', item: "Utilidad",                serie: "",                             annual: calcAnnual(oDet.Utilidad),     date: new Date(), monthly: getVal(oDet.Utilidad) },
//             { key: 'Z012', item: "Descuento",               serie: "",                             annual: calcAnnual(oDet.Descuento),    date: new Date(), monthly: getVal(oDet.Descuento) },
//             { key: '06',   item: "Precio Neto",             serie: "",                             annual: 0,                             date: new Date(), monthly: 0 }
//         ];

//         this.oContractManagement.setProperty('/arrWorkForce', arrResults);
        
//         // Recalcular los totales (Fila '06')
//         this._onCalculateTotalWorkForce();

//     } catch (oError: any) {
//         console.error("Error en _onGetWorkForce:", oError);
//         this.oContractManagement.setProperty('/arrWorkForce', []);
//         MessageBox.error(oError.message || "Error al obtener datos de determinación");
//     } finally {
//         this.oContractManagement.refresh(true);
//         BusyIndicator.hide();
//     }
// }





private async _onGetWorkForce(): Promise<void> {
    const oDataModel = this.ZCS_GET_DETERMINATION_SRV;
    if (!oDataModel) return;

    if (!this.sPahtEquipement) {
        MessageBox.error("No se encontró el equipo seleccionado.");
        return;
    }

    const oEquipment = this.oContractManagement.getProperty(this.sPahtEquipement);
    
    if (oEquipment.workForce && oEquipment.workForce.length > 0) {
        const arrFixedWorkForce = oEquipment.workForce.map((item: any) => ({
            ...item,
            date: item.date ? new Date(item.date) : new Date()
        }));
        this.oContractManagement.setProperty('/arrWorkForce', arrFixedWorkForce);
        this._onCalculateTotalWorkForce();
        return;
    }

    const sSerie = oEquipment.EquipmentB;
    if (!sSerie) {
        MessageBox.error("No se ha identificado el número de equipo.");
        return;
    }

    const sEquipmentID = oEquipment.EquipmentB;
    let fManoObraMensualZ050 = 0;
    try {
        const { data: oManoObra } = await ERP.readDataKeysERP(`/ManoObraSet('${sSerie}')`, this.ZCS_GET_COST_MAINTAIN_SRV);
        fManoObraMensualZ050 = parseFloat(oManoObra.ValorTotal || "0") / 12;
    } catch (e) {
        console.warn("No se pudo obtener Mano de Obra, se usará 0", e);
    }

    BusyIndicator.show(0);

    oDataModel.read("/DeterminationHeaderSet", {
        filters: [new Filter("Serie", FilterOperator.EQ, sSerie)],
        urlParameters: {
            "$expand": "DeterminationNivelSet,DeterminationServicioSet,DeterminationContratoSet,DeterminationUsoSet"
        },
        success: (oData: any) => {
            BusyIndicator.hide();
            const aResults = oData.results ? oData.results : (oData.d ? oData.d.results : []);

            if (aResults.length === 0) {
                MessageBox.error("No se encontró el esquema para la serie: " + sSerie);
                return;
            }

            const oDet = aResults[0];
            this.fTopeDescuento = parseFloat(oDet.Descuento || "0");

            let sCustomerGroup1 = "";
            let sUsageType = "";
            let sUsageTypeText = "";
            let sServiceType = "";
            
            if (this.oInfoMaterial && this.oInfoMaterial.materialPositions && this.oInfoMaterial.materialPositions.length > 0) {
                const iIndex = this.oInfoMaterial.materialPositions[0];
                const oMaterial = this.oContractManagement.getProperty(`/arrMaterial/${iIndex}`);
                sCustomerGroup1 = oMaterial ? (oMaterial.selectedCustomerGroup1 || "") : "";
                sUsageType = oMaterial ? (oMaterial.selectedUsageType || "") : "";
                sUsageTypeText = oMaterial ? (oMaterial.selectedUsageTypeText || "") : "";
                sServiceType = oMaterial ? (oMaterial.selectedWorkingHours || "") : "";
            }

            const getVal = (val: string) => parseFloat(val ? val.trim() : "0");

            const arrContratosExpand = oDet.DeterminationContratoSet?.results || [];
            const oContratoEncontrado = arrContratosExpand.find((oC: any) => oC.TipoContrato?.trim() === sCustomerGroup1.trim());
            const fMontoContrato = oContratoEncontrado ? getVal(oContratoEncontrado.Monto) : 0;

            let iNivelActual = oDet.Niveles?.includes("=") ? parseInt(oDet.Niveles.split("=").pop().trim(), 10) : 0;
            const arrNivelesExpand = oDet.DeterminationNivelSet?.results || [];
            const oRango = arrNivelesExpand.find((r: any) => iNivelActual >= parseInt(r.NivelInf, 10) && iNivelActual <= parseInt(r.NivelSp, 10));
            const fPorcentajeNivel = oRango ? parseFloat(oRango.Porcentaje || "0") : 0;
            const fValorMensualZ020 = fMontoContrato * (fPorcentajeNivel / 100);

            const arrUsoExpand = oDet.DeterminationUsoSet?.results || [];
            const oUsoEncontrado = arrUsoExpand.find((oU: any) => oU.TipoUso?.trim() === sUsageType.trim());
            const fValorTipoUso = oUsoEncontrado ? getVal(oUsoEncontrado.ValorTipo) : 0;
            const fValorMensualZ030 = fMontoContrato * (fValorTipoUso / 100);

            const arrServicioExpand = oDet.DeterminationServicioSet?.results || [];
            const oServicioEncontrado = arrServicioExpand.find((oS: any) => oS.TipoServicio?.trim() === sServiceType.trim());
            const fValorTipoServicio = oServicioEncontrado ? getVal(oServicioEncontrado.ValorTipo) : 0;
            const fValorMensualZ040 = fMontoContrato * (fValorTipoServicio / 100);

            const fValorMensualZ080 = fMontoContrato * (getVal(oDet.ServTraslado) / 100);
            const fValorMensualZ090 = fMontoContrato * (getVal(oDet.AtencFalla) / 100);
            const fValorMensualZ100 = fMontoContrato * (getVal(oDet.GOP) / 100);
            const fValorMensualZ110 = fMontoContrato * (getVal(oDet.Utilidad) / 100);
            const fValorMensualZ120 = fMontoContrato * (getVal(oDet.Descuento) / 100);

            const arrResults: any[] = [
                { key: 'Z010', item: "Tipo de Contrato",      serie: oDet.Serie,              serie2: sServiceType,            date: new Date(), monthly: fMontoContrato,           annual: fMontoContrato * 12 },
                { key: 'Z020', item: "Niveles del Equipo",    serie: oDet.Niveles || "",      serie2: fPorcentajeNivel + " %", date: new Date(), monthly: fValorMensualZ020,        annual: fValorMensualZ020 * 12 }, 
                { key: 'Z030', item: "Tipo de Uso",           serie: sUsageTypeText,          serie2: fValorTipoUso + " %",    date: new Date(), monthly: fValorMensualZ030,        annual: fValorMensualZ030 * 12 },
                { key: 'Z040', item: "Tipo de Servicio",      serie: sServiceType,            serie2: fValorTipoServicio + " %", date: new Date(), monthly: fValorMensualZ040,      annual: fValorMensualZ040 * 12 }, 
                { key: 'Z050', item: "Mano de Obra",          serie: "",                      serie2: "",                      date: new Date(), monthly: fManoObraMensualZ050,    annual: fManoObraMensualZ050 * 12 }, 
                { key: 'Z060', item: "Insumos",               serie: "",                      serie2: "",                      date: new Date(), monthly: 0,                        annual: 0 },
                { key: 'Z070', item: "Refaccionamiento",      serie: "",                      serie2: "",                      date: new Date(), monthly: 0,                        annual: 0 },
                { key: 'Z080', item: "Serv Traslado",         serie: "",                      serie2: oDet.ServTraslado + " %", date: new Date(), monthly: fValorMensualZ080,        annual: fValorMensualZ080 * 12 },
                { key: 'Z090', item: "Atenció. a fallas",     serie: "",                      serie2: oDet.AtencFalla + " %",  date: new Date(), monthly: fValorMensualZ090,        annual: fValorMensualZ090 * 12 },
                { key: 'Z100', item: "Gastos de operacion",   serie: "",                      serie2: oDet.GOP + " %",         date: new Date(), monthly: fValorMensualZ100,        annual: fValorMensualZ100 * 12 },
                { key: 'Z110', item: "Utilidad",              serie: "",                      serie2: oDet.Utilidad + " %",    date: new Date(), monthly: fValorMensualZ110,        annual: fValorMensualZ110 * 12 },
                //{ key: 'ZSTT', item: "Subtotal",              serie: "",                      serie2: "",                      date: new Date(), monthly: 0,                        annual: 0 },
                { key: 'Z120', item: "Descuento Máximo",      serie: "",                      serie2: "-" + oDet.Descuento + " %",   date: new Date(), monthly: 0,                        annual:"-" + 0 },
                { key: 'Z130', item: "Precio Neto",           serie: "",                      serie2: "",                      date: new Date(), monthly: 0,                        annual: 0 }
            ];

            this.oContractManagement.setProperty('/arrWorkForce', arrResults);
            this._onCalculateTotalWorkForce();
            this.oContractManagement.refresh(true);
        },
        error: (oError: any) => {
            BusyIndicator.hide();
            console.error("Error al obtener datos:", oError);
            MessageBox.error("Error al obtener el esquema de cálculo.");
        }
    });
}

  public onCloseWorkForce(): void {
    this.oContractManagement.setProperty("/arrWorkForce", []);
    this.oContractManagement.refresh(true);
    this.oFragmentCup.close();
}

public onSaveWorkForce(): void {
    console.log("=== onSaveWorkForce ===");

    if (!this.sPahtEquipement) {
        console.error("❌ ERROR: No hay path del equipo");
        MessageBox.error("No se pudo guardar el CUP, no se identificó el equipo.");
        return;
    }

    console.log("Ruta equipo actual:", this.sPahtEquipement);

    const arrWorkForce: any[] = this.oContractManagement.getProperty("/arrWorkForce") || [];
    console.log("arrWorkForce del popup antes de guardar:", JSON.parse(JSON.stringify(arrWorkForce)));

    const oFoundTotalMonthly = arrWorkForce.find((oWorkForce: any) => oWorkForce.key === "Z130");
    console.log("Fila TOTAL encontrada:", JSON.parse(JSON.stringify(oFoundTotalMonthly)));

    if (!oFoundTotalMonthly) {
        console.warn("No se encontró la fila con key = 'Z130'");
        MessageBox.warning("No se encontró el total del CUP.");
        return;
    }

    const arrToSave = arrWorkForce.map((item: any) => {
        return {
            ...item,
            date: item.date instanceof Date ? item.date.toISOString() : item.date
        };
    });

    // Guardar CUP y workforce en el equipo actual
    this.oContractManagement.setProperty(
        `${this.sPahtEquipement}/cup`,
        Number(oFoundTotalMonthly.monthly || 0)
    );
    this.oContractManagement.setProperty(
        `${this.sPahtEquipement}/workForce`,
        arrToSave
    );

    // Recalcular total de CUP de todos los equipos
    const arrIDMaterialPos = this.oInfoMaterial?.materialPositions || [];
    const arrEquipment: ItemEquipment[] = this.oContractManagement.getProperty("/arrEquipment") || [];

    let iTotalCUP = 0;
    arrEquipment.forEach((e) => {
        iTotalCUP += Number(e.cup || 0);
    });

    // Reflejar inmediatamente en el material del Main
    for (const iPosition of arrIDMaterialPos) {
        this.oContractManagement.setProperty(`/arrMaterial/${iPosition}/arrEquipment`, arrEquipment);
        this.oContractManagement.setProperty(`/arrMaterial/${iPosition}/hasEquipment`, true);
        this.oContractManagement.setProperty(`/arrMaterial/${iPosition}/netValue`, iTotalCUP);
    }

    this.oContractManagement.refresh(true);

    console.log("CUP guardado en equipo:", this.oContractManagement.getProperty(`${this.sPahtEquipement}/cup`));
    console.log("workForce guardado en equipo:", JSON.parse(JSON.stringify(
        this.oContractManagement.getProperty(`${this.sPahtEquipement}/workForce`)
    )));
    console.log("Equipo completo después de guardar:", JSON.parse(JSON.stringify(
        this.oContractManagement.getProperty(this.sPahtEquipement)
    )));

    this.onCloseWorkForce();
}
//    public _onCalculateTotalWorkForce(): void {
//     const arrWorkForce = this.oContractManagement.getProperty("/arrWorkForce") || [];

//     let iTotalAnnual = 0;
//     let iTotalMonthly = 0;

//     // Sumar todos los rubros EXCEPTO ZVKP (Precio Neto)
//     for (const oWorkForce of arrWorkForce) {
//         if (oWorkForce.key !== "ZVKP") {
//             iTotalAnnual += Number(oWorkForce.annual || 0);
//             iTotalMonthly += Number(oWorkForce.monthly || 0);
//         }
//     }

//     // Asignar el total a la fila ZVKP
//     const iIndexTotal = arrWorkForce.findIndex((item: any) => item.key === "ZVKP");

//     if (iIndexTotal !== -1) {
//         arrWorkForce[iIndexTotal].annual = iTotalAnnual;
//         arrWorkForce[iIndexTotal].monthly = iTotalMonthly;
//     }

//     this.oContractManagement.setProperty("/arrWorkForce", arrWorkForce);
//     this.oContractManagement.refresh(true);
// }

public _onCalculateTotalWorkForce(): void {
    const arrWorkForce = this.oContractManagement.getProperty("/arrWorkForce") || [];

    console.log("=== _onCalculateTotalWorkForce ===");

    // 1. Calcular Subtotal (Suma de todo excepto Utilidad, Subtotal, Descuento y Neto)
    let fSubtotalMonthly = 0;
    const keysToExcludeFromSubtotal = ['Z110', 'Z120', 'ZSTT', 'Z130'];

    for (const oWorkForce of arrWorkForce) {
        if (!keysToExcludeFromSubtotal.includes(oWorkForce.key)) {
            fSubtotalMonthly += Number(oWorkForce.monthly || 0);
        }
    }

    

    // 2. Actualizar fila de Subtotal (ZSTT)
    const oSubtotal = arrWorkForce.find((item: any) => item.key === 'ZSTT');
    if (oSubtotal) {
        oSubtotal.monthly = fSubtotalMonthly;
        oSubtotal.annual = fSubtotalMonthly * 12;
    }

    // 3. Calcular Precio Neto (ZVKP = Subtotal - Descuento)
    const oDescuento = arrWorkForce.find((item: any) => item.key === 'Z120');
    if (oDescuento) {
        // Aquí ocurre la magia: siempre recalcula el annual basado en el monthly actual
        oDescuento.annual = Number(oDescuento.monthly || 0) * 12;
    }
    const fDescuentoMonthly = oDescuento ? Number(oDescuento.monthly || 0) : 0;
    
    const fPrecioNetoMonthly = fSubtotalMonthly - fDescuentoMonthly;

    const oNeto = arrWorkForce.find((item: any) => item.key === 'Z130');
    if (oNeto) {
        oNeto.monthly = fPrecioNetoMonthly;
        oNeto.annual = fPrecioNetoMonthly * 12;
    }

    // 4. Guardar y refrescar
    this.oContractManagement.setProperty("/arrWorkForce", arrWorkForce);
    this.oContractManagement.refresh(true);

    console.log("Subtotal calculado:", fSubtotalMonthly);
    console.log("Precio Neto calculado:", fPrecioNetoMonthly);
}



// public onChangeWorkForce(): void {
//     this._onCalculateTotalWorkForce();
// }


public onChangeWorkForce(oEvent: any) {
    const oInput = oEvent.getSource();
    const oContext = oInput.getBindingContext("mContractManagement");
    const oItem = oContext.getObject();

    if (oItem.key === 'Z120') {
    const fNuevoValor = Number(oInput.getValue());
    
    // Obtener el límite del objeto (ajusta esta ruta según cómo guardaste el valor de descuento en tu modelo)
    // Suponiendo que el límite está en oDet.Descuento, asegúrate de tener acceso a ese valor.
    // Si no tienes acceso a oDet aquí, usa un valor fijo o una variable global.
    const fLimitePermitido = this.fTopeDescuento;

    if (fNuevoValor > fLimitePermitido) {
        MessageBox.confirm("El descuento solicitado supera el límite permitido. ¿Desea enviar una solicitud al área de Finanzas?", {
            onClose: (sAction: string) => {
                if (sAction === MessageBox.Action.OK) {
                    MessageToast.show("Solicitud enviada a Finanzas.");
                } else {
                    oInput.setValue(0);
                    oItem.monthly = 0;
                    this._onCalculateTotalWorkForce();
                    }
                }
            });
        }
    }
    
    // Al final del cambio, siempre recalcular
    this._onCalculateTotalWorkForce();
}


    /**
     * Consulta el servicio OData ZCS_GET_BOM_MATERIAL_SRV con el filtro Intrm eq '3'
     * y abre el diálogo de revisión.
     */
    public async onCheckBOM(sEquipmentID: string, sMaterial: string): Promise<void> {
        this.sCurrentEquipmentID = sEquipmentID;

       MessageToast.show("Se te mostrarán los materiales permitidos en la cobertura, espera un momento", {
            at: "CenterTop", // Posición: Centro vertical y horizontal
            width: "25rem",      // Ancho un poco mayor para que se lea bien
            offset: "0 20", // Mover 0px horizontal, 50px hacia abajo       // Duración en milisegundos (3 segundos)
            duration: 3000
            
        });

        BusyIndicator.show(0);

        try {
            // 1. Preparamos el filtro específico
            const aFilters = [
                new Filter("Intrm", FilterOperator.EQ, sMaterial),
                new Filter("Werks", FilterOperator.EQ, "TLP1") 
            ];

            // 2. Llamada usando tu helper ERP
            const { data } = await ERP.readDataKeysERP(
                "/BomItemsSet", 
                this.ZCS_GET_BOM_MATERIAL_SRV, 
                aFilters
            );

            // 3. Mapeo de resultados
            const arrBOM: any[] = data.results.map((item: any) => ({
                Material: item.Idnrk,
                Description: item.Ojtxp,
                Quantity: item.Mnglg,
                Unit: item.Mmein,
                IsManual: false
            }));

            // 4. Actualizar Modelo Local
            this.oContractManagement.setProperty('/arrBOM', arrBOM);
            this.oContractManagement.setProperty('/isCustomBOM', false);

            // 5. Abrir Popup
            await this.onOpenBOMDialog();

        } catch (error: any) {
            MessageBox.error("Error al obtener la lista de materiales (BOM): " + error.message);
        } finally {
            BusyIndicator.hide();
        }
    }
// fin de los cambios para el cup 

    public async onOpenBOMDialog(): Promise<void> {
        this.oFragmentBOM ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.DialogBOM",
            controller: this,
        }) as Dialog;

        this.getView()?.addDependent(this.oFragmentBOM);
        this.oFragmentBOM.open();
    }

    public onSwitchToCustomBOM(): void {
        MessageBox.confirm(
            this.oI18n.getText("confirmCustomBOM") || "Al modificar, se creará una alternativa. ¿Desea continuar?",
            {
                onClose: (sAction: string) => {
                    if (sAction === MessageBox.Action.OK) {
                        this.oContractManagement.setProperty('/isCustomBOM', true);
                    }
                }
            }
        );
    }

    public onAddBOMMaterial(): void {
        const arrBOM = this.oContractManagement.getProperty('/arrBOM');
        arrBOM.push({
            Material: "",
            Description: "",
            Quantity: 1,
            Unit: "PC",
            IsManual: true
        });
        this.oContractManagement.refresh(true);
    }

    public async onConfirmBOM(): Promise<void> {
        const bIsCustom = this.oContractManagement.getProperty('/isCustomBOM');
        const arrBOM = this.oContractManagement.getProperty('/arrBOM');

        this.oFragmentBOM.close();

        if (bIsCustom) {
            await this._createAlternativeBOM(arrBOM);
        } else {
            MessageBox.success(this.oI18n.getText("bomAssigned") || "Lista de materiales estándar asignada.");
        }
    }

    private async _createAlternativeBOM(arrBOM: any[]): Promise<void> {
        BusyIndicator.show(0);
        try {
            const oPayload = {
                Equipment: this.sCurrentEquipmentID,
                Items: arrBOM
            };

            await ERP.createDataERP(
                "/AlternativeBOMSet", 
                this.ZCS_GET_COST_MAINTAIN_SRV, 
                oPayload
            );
            // --- AÑADE ESTO ---
// Esto obliga a que todos los campos vinculados al modelo se actualicen en la UI
this.oContractManagement.refresh(true); 

// Si usas un ODataModel v2 directamente para la tabla, usa:
// this.getView().getModel().refresh(true);

            MessageBox.success(this.oI18n.getText("alternativeCreated") || "Alternativa creada exitosamente.");

        } catch (error: any) {
            MessageBox.error(error.message);
            this.oFragmentBOM.open(); 
        } finally {
            BusyIndicator.hide();
        }
    }

    public onCancelBOM(): void {
        this.oFragmentBOM.close();
        this.oContractManagement.setProperty('/arrBOM', []);
    }
}