import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import ODataListBinding from "sap/ui/model/odata/v2/ODataListBinding";
import ContextV2 from "sap/ui/model/odata/v2/Context";
import Fragment from "sap/ui/core/Fragment";
import Dialog from "sap/m/Dialog";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import { TableSelectDialog$ConfirmEvent, TableSelectDialog$SearchEvent } from "sap/m/TableSelectDialog";
import {
    Create_Quotation,
    Customer,
    EquipmentByWorkForce,
    Header,
    ItemEquipment,
    Items,
    ItemsAndData,
    QuotationConditionsInSet,
    QuotationDataInSet,
    QuotationEquipmentInSet,
    QuotationHeaderIn,
    QuotationItemsInSet,
    WorkForce
} from "../model/types";
import Input, { Input$ValueHelpRequestEvent } from "sap/m/Input";
import formatter from "contractmanagement/contractmanagement/model/formatter";
import Table, { Table$RowSelectionChangeEvent } from "sap/ui/table/Table";
import MessageBox from "sap/m/MessageBox";
import BusyIndicator from "sap/ui/core/BusyIndicator";
import Button, { Button$PressEvent } from "sap/m/Button";
import ERP from "contractmanagement/contractmanagement/modules/ERP";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import MessageToast from "sap/m/MessageToast";
import ShellUIService from "sap/ushell/ui5service/ShellUIService";

/**
 * @namespace contractmanagement.contractmanagement.controller
 */
export default class Main extends Controller {
    public formatter = formatter;

    private oContractManagement!: JSONModel;
    private oI18nModel!: ResourceModel;
    private oI18n!: ResourceBundle;
    private oRouter!: Router;
    private oFragmentType!: Dialog;
    private oFragmentContractType!: Dialog;
    private oFragmentOfferType!: Dialog;
    private oFragmentSalesOrg!: Dialog;
    private oFragmentChannel!: Dialog;
    private oFragmentSector!: Dialog;
    private oFragmentSalesOffice!: Dialog;
    private oFragmentSalesGroup!: Dialog;
    private oFragmentRequester!: Dialog;
    private oFragmentCurrency!: Dialog;
    private oFragmentMaterial!: Dialog;
    private oFragmentCabe!: Dialog;
    private oFragmentOrderReason!: Dialog;
    private oFragmentShipTo!: Dialog;
    private sPahtMaterial!: string;
    private arrIndexSelectRowMaterial: number[] = [];
    private ZSD_CREATE_QUOTATION_CUSTOMER_SRV!: ODataModel;

    private _isDirty = false;
    private oShellUIService: ShellUIService | null = null;
    private _ignoreNextPopState = false;
    private _hasHistoryEntry = false;

    public onInit(): void {
        this.oContractManagement = this.getOwnerComponent()?.getModel("mContractManagement") as JSONModel;
        this.oI18nModel = this.getOwnerComponent()?.getModel("i18n") as ResourceModel;
        this.oI18n = this.oI18nModel.getResourceBundle() as ResourceBundle;
        this.oRouter = (this.getOwnerComponent() as UIComponent).getRouter();
        this.ZSD_CREATE_QUOTATION_CUSTOMER_SRV =
            this.getOwnerComponent()?.getModel("ZSD_CREATE_QUOTATION_CUSTOMER_SRV") as ODataModel;

        this.oRouter.getRoute("RouteMain")!.attachPatternMatched(this._onRouteMatched, this);

        (this.getOwnerComponent() as any).getService("ShellUIService")
            .then((oService: ShellUIService) => {
                this.oShellUIService = oService;

                if (oService && typeof (oService as any).setBackNavigation === "function") {
                    (oService as any).setBackNavigation(this._handleShellBack.bind(this));
                }
            })
            .catch((oError: unknown) => {
                console.error("Error obteniendo ShellUIService:", oError);
            });

        window.addEventListener("beforeunload", this._handleBeforeUnload);
        window.addEventListener("popstate", this._handlePopState);

        this._pushGuardHistoryState();
    }

    public onExit(): void {
        window.removeEventListener("beforeunload", this._handleBeforeUnload);
        window.removeEventListener("popstate", this._handlePopState);
    }

    public onFormChanged(): void {
        this._markAsDirty();
    }

    private _markAsDirty(): void {
        this._isDirty = true;
    }

    private _pushGuardHistoryState(): void {
        try {
            window.history.pushState(
                { page: "main-contract", guard: true, ts: Date.now() },
                "",
                window.location.href
            );
            this._hasHistoryEntry = true;
        } catch (oError) {
            console.warn("No se pudo insertar estado de protección en history:", oError);
        }
    }

    private _handleBeforeUnload = (oEvent: BeforeUnloadEvent): void => {
        if (!this._isDirty) {
            return;
        }

        oEvent.preventDefault();
        oEvent.returnValue = "";
    };

    private _confirmLeave(onConfirm: () => void): void {
        if (!this._isDirty) {
            onConfirm();
            return;
        }

        MessageBox.confirm("Tienes cambios sin guardar, ¿deseas salir de la sesión?", {
            title: "Confirmar salida",
            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
            emphasizedAction: MessageBox.Action.NO,
            onClose: (oAction: string) => {
                if (oAction === MessageBox.Action.YES) {
                    this._isDirty = false;
                    onConfirm();
                } else {
                    this._pushGuardHistoryState();
                }
            }
        });
    }

    private _navigateBack(): void {
        try {
            const oCrossAppNav = (window as any).sap?.ushell?.Container?.getService("CrossApplicationNavigation");

            if (oCrossAppNav) {
                oCrossAppNav.toExternal({ target: { shellHash: "#" } });
            } else {
                this._ignoreNextPopState = true;
                window.history.back();
            }
        } catch (oError) {
            console.error("Error al regresar:", oError);
            this._ignoreNextPopState = true;
            window.history.back();
        }
    }

    private _handlePopState = (_oEvent: PopStateEvent): void => {
        if (this._ignoreNextPopState) {
            this._ignoreNextPopState = false;
            return;
        }

        this._confirmLeave(() => {
            this._navigateBack();
        });
    };

    private _handleShellBack(): void {
        this._confirmLeave(() => {
            this._navigateBack();
        });
    }

    public onCopyItem(oEvent: any): void {
        const oModel = this.getView()!.getModel("mContractManagement") as JSONModel;
        const oCtx = oEvent.getSource().getBindingContext("mContractManagement");
        if (!oCtx) return;

        const oCurrentItem = oCtx.getObject();
        const sYes = MessageBox.Action.YES;
        const sNo = MessageBox.Action.NO;

        MessageBox.confirm("¿Desea copiar también el valor neto del CUP?", {
            title: "Confirmar copia de CUP",
            actions: [sYes, sNo],
            onClose: (oAction: any) => {
                const aMaterials = [...(oModel.getProperty("/arrMaterial") || [])];

                let oRespaldo = null;
                if (oAction === sYes && oCurrentItem.arrEquipment && oCurrentItem.arrEquipment.length > 0) {
                    oRespaldo = {
                        cup: oCurrentItem.arrEquipment[0].cup,
                        workForce: JSON.parse(JSON.stringify(oCurrentItem.arrEquipment[0].workForce || []))
                    };
                    console.log("Mitsu - Respaldo Creado:", oRespaldo);
                }

                const oNewItem = {
                    ...oCurrentItem,
                    arrEquipment: [],
                    netValue: (oAction === sYes) ? oCurrentItem.netValue : 0,
                    hasEquipment: false,
                    tempCUP: oRespaldo,
                    oMaterial: oCurrentItem.oMaterial ? { ...oCurrentItem.oMaterial } : null,
                    oCebe: oCurrentItem.oCebe ? { ...oCurrentItem.oCebe } : { Profit: "BSMANACONT", Description: "" }
                };

                aMaterials.push(oNewItem);
                oModel.setProperty("/arrMaterial", aMaterials);
                oModel.refresh(true);
                this._markAsDirty();
                console.log("Mitsu - Fila clonada con tempCUP:", oNewItem);

                const oTable = this.byId("tblMaterial") as any;
                if (oTable) {
                    const iNewIndex = aMaterials.length - 1;
                    setTimeout(() => {
                        oTable.clearSelection();
                        oTable.setSelectedIndex(iNewIndex);
                        this.arrIndexSelectRowMaterial = [iNewIndex];
                        oTable.setFirstVisibleRow(iNewIndex);
                    }, 200);
                }
            }
        });
    }

    private _onRouteMatched(): void {
        this._pushGuardHistoryState();

        const oToday = new Date();

        this.oContractManagement.setProperty("/header", {
            orderDate: oToday,
            oType: { Name: "CO", Description: "Contrato" },
            oOfferType: { Auart: "AV", Bezei: "Oferta p.contrato" },
            oSalesOrganization: { Vkorg: "MEL1", Vtext: "Mitsubishi Electric" },
            oChannel: { Vtweg: "NA", Vtext: "Canal Nacional" },
            oSector: { Spart: "MS", Vtext: "MaintenanceServiceC" },
            oCurrency: { CurrencyCode: "MXN", CurrencyName: "Pesos mexicanos" },
            paymentTerms: "Z001",
            paymentMethod: null
        });

        const aPaymentTerms = [
            { Zterm: "K008", Vtext: "dentro de los 8 días sin DPP" },
            { Zterm: "K010", Vtext: "dentro de los 10 días sin DPP" },
            { Zterm: "K015", Vtext: "dentro de los 15 días sin DPP" },
            { Zterm: "K030", Vtext: "dentro de los 30 días sin DPP" },
            { Zterm: "Z001", Vtext: "Pagadero inmediatamente sin DPP" },
            { Zterm: "Z030", Vtext: "Pagadero inmediatamente sin DPP Fecha base el 30." },
            { Zterm: "Z120", Vtext: "Pagadero inmediatamente sin DPP Fecha base Fin de mes" }
        ];

        this.oContractManagement.setProperty("/paymentTermsList", aPaymentTerms);

        const oModelOData = this.getOwnerComponent()?.getModel("ZSD_CATALOGOS_SRV") as ODataModel;

        oModelOData.read("/PaymentMethodSet", {
            filters: [new Filter("Land1", FilterOperator.EQ, "MX")],
            success: (oData: any) => {
                this.oContractManagement.setProperty("/paymentMethods", oData.results);
            },
            error: (oError: any) => {
                console.error("Error al cargar el catálogo de pagos:", oError);
            }
        });
    }

    public async onOpenPopUpType(): Promise<void> {
        this.oFragmentType ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblType",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentType);
        this.oFragmentType.open();
    }

    public onSearchType(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("Name", FilterOperator.Contains, sValue),
                new Filter("Description", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectType(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        for (const oSelect of oSelectedContext) {
            this.oContractManagement.setProperty("/header/oType", oSelect.getObject());
        }
        this._markAsDirty();
    }

    public async onOpenPopUpContractType(): Promise<void> {
        this.oFragmentContractType ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblContractType",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentContractType);
        this.oFragmentContractType.open();
    }

    public onSearchContractType(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("Name", FilterOperator.Contains, sValue),
                new Filter("Description", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectContractType(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        for (const oSelect of oSelectedContext) {
            this.oContractManagement.setProperty("/header/oContractType", oSelect.getObject());
        }
        this._markAsDirty();
    }

    public async onOpenPopUpOfferType(): Promise<void> {
        this.oFragmentOfferType ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblOfferType",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentOfferType);
        this.oFragmentOfferType.open();
    }

    public onSearchOfferType(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("Auart", FilterOperator.Contains, sValue),
                new Filter("Bezei", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectOfferType(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        for (const oSelect of oSelectedContext) {
            this.oContractManagement.setProperty("/header/oOfferType", oSelect.getObject());
        }
        this._markAsDirty();
    }

    public async onOpenPopUpSalesOrganization(): Promise<void> {
        this.oFragmentSalesOrg ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblSalesOrganization",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentSalesOrg);
        this.oFragmentSalesOrg.open();
    }

    public onSearchSalesOrganization(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("Vkorg", FilterOperator.Contains, sValue),
                new Filter("Vtext", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectSalesOrganization(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        for (const oSelect of oSelectedContext) {
            this.oContractManagement.setProperty("/header/oSalesOrganization", oSelect.getObject());
        }
        this._markAsDirty();
    }

    public async onOpenPopUpChannel(): Promise<void> {
        this.oFragmentChannel ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblChannel",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentChannel);
        this.oFragmentChannel.open();
    }

    public onSearchChannel(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("Vtweg", FilterOperator.Contains, sValue),
                new Filter("Vtext", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectChannel(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        for (const oSelect of oSelectedContext) {
            this.oContractManagement.setProperty("/header/oChannel", oSelect.getObject());
        }
        this._markAsDirty();
    }

    public async onOpenPopUpSector(): Promise<void> {
        this.oFragmentSector ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblSector",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentSector);
        this.oFragmentSector.open();
    }

    public onSearchSector(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("Spart", FilterOperator.Contains, sValue),
                new Filter("Vtext", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectSector(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        for (const oSelect of oSelectedContext) {
            this.oContractManagement.setProperty("/header/oSector", oSelect.getObject());
        }
        this._markAsDirty();
    }

    public async onOpenPopUpSalesOffice(): Promise<void> {
        this.oFragmentSalesOffice ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblSalesOffice",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentSalesOffice);
        this.oFragmentSalesOffice.open();
    }

    public onSearchSalesOffice(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("Office", FilterOperator.Contains, sValue),
                new Filter("Description", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectSalesOffice(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        for (const oSelect of oSelectedContext) {
            this.oContractManagement.setProperty("/header/oSalesOffice", oSelect.getObject());
        }
        this._markAsDirty();
    }

    public async onOpenPopUpSalesGroup(): Promise<void> {
        this.oFragmentSalesGroup ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblSalesGroup",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentSalesGroup);
        this.oFragmentSalesGroup.open();
    }

    public onSearchSalesGroup(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("Group", FilterOperator.Contains, sValue),
                new Filter("Description", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectSalesGroup(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        for (const oSelect of oSelectedContext) {
            this.oContractManagement.setProperty("/header/oSalesGroup", oSelect.getObject());
        }
        this._markAsDirty();
    }

    public async onOpenPopUpRequester(): Promise<void> {
        this.oFragmentRequester ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblCustomer",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentRequester);
        this.oFragmentRequester.open();
    }

    public async onOpenPopUpShipTo(): Promise<void> {
        this.oFragmentShipTo ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblShipTo",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentShipTo);
        this.oFragmentShipTo.open();
    }

    public onSearchRequester(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("CustomerCode", FilterOperator.Contains, sValue),
                new Filter("Name1", FilterOperator.Contains, sValue),
                new Filter("RFC", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSearchShipTo(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("CustomerCode", FilterOperator.Contains, sValue),
                new Filter("Name1", FilterOperator.Contains, sValue),
                new Filter("RFC", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectRequester(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        for (const oSelect of oSelectedContext) {
            this.oContractManagement.setProperty("/header/oRequester", oSelect.getObject());
        }
        this._markAsDirty();
    }

    public onSelectShipTo(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        if (oSelectedContext && oSelectedContext.length > 0) {
            for (const oSelect of oSelectedContext) {
                this.oContractManagement.setProperty("/header/oShipTo", oSelect.getObject());
            }
            this._markAsDirty();
        }
    }

    public async onOpenPopUpCurrency(): Promise<void> {
        this.oFragmentCurrency ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblCurrency",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentCurrency);
        this.oFragmentCurrency.open();
    }

    public onSearchCurrency(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("CurrencyCode", FilterOperator.Contains, sValue),
                new Filter("CurrencyName", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectCurrency(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        for (const oSelect of oSelectedContext) {
            this.oContractManagement.setProperty("/header/oCurrency", oSelect.getObject());
        }
        this._markAsDirty();
    }

    public addMaterial(): void {
        const arrMaterial: Items[] = this.oContractManagement.getProperty("/arrMaterial");
        const oHeader: Header = this.oContractManagement.getProperty("/header");

        const oMaterial: Items = {
            oMaterial: null,
            oCebe: {
                Profit: "BSMANACONT",
                Description: ""
            },
            selectedKeyCenter: "TLP1",
            oOrderReason: null,
            netValue: 0,
            selectedWorkingHours: null,
            selectedCustomerGroup1: null,
            selectedCustomerGroup3: null,
            selectedCustomerGroup4: null,
            selectedCustomerGroup5: null,
            selectedCustGroup: null,
            selectedUsageType: null,
            selectedUsageTypeText: null,
            hasEquipment: false,
            validFromDate: oHeader.validFromDate,
            validUntilDate: oHeader.validUntilDate,
            isCustomerGroup1Locked: false,
            arrEquipment: []
        };

        arrMaterial.push(oMaterial);
        this.oContractManagement.refresh(true);
        this._markAsDirty();
    }

    public onDeleteRow(): void {
        const oTable = this.byId("tblMaterial") as Table;
        const arrMaterial: Items[] = this.oContractManagement.getProperty("/arrMaterial");

        if (this.arrIndexSelectRowMaterial.length === 0) {
            MessageBox.alert(this.oI18n.getText("errorDeleteRows") ?? "");
        } else {
            for (const indexRowSelect of [...this.arrIndexSelectRowMaterial].sort((a, b) => b - a)) {
                arrMaterial.splice(indexRowSelect, 1);
            }
            this.oContractManagement.refresh(true);
            oTable.clearSelection();
            this.arrIndexSelectRowMaterial = [];
            this._markAsDirty();
        }
    }

    public onSelectRow(oEvent: Table$RowSelectionChangeEvent): void {
        const oSource: Table = oEvent.getSource();
        const arrSelectedRow: number[] = oSource.getSelectedIndices();
        this.arrIndexSelectRowMaterial = arrSelectedRow;
    }

    public onChangeUsageType(oEvent: any): void {
        const oSource = oEvent.getSource();
        const oSelectedItem = oSource.getSelectedItem();
        const sSelectedText = oSelectedItem ? oSelectedItem.getText() : "";
        const oBindingContext = oSource.getBindingContext("mContractManagement") as ContextV2;

        if (oBindingContext) {
            const sPath = oBindingContext.getPath();
            const sUsageTypeCode = this._extractUsageTypeCode(sSelectedText);
            const sUsageTypeDescription = this._extractUsageTypeDescription(sSelectedText);

            this.oContractManagement.setProperty(`${sPath}/selectedUsageType`, sUsageTypeCode);
            this.oContractManagement.setProperty(`${sPath}/selectedUsageTypeText`, sUsageTypeDescription);
            this.oContractManagement.refresh(true);
            this._markAsDirty();
        }
    }

    private _extractUsageTypeDescription(sText: string): string {
        if (!sText) {
            return "";
        }

        const aParts = sText.split(" - ");

        if (aParts.length > 1) {
            return aParts.slice(1).join(" - ").trim();
        }

        return sText.trim();
    }

    private _extractUsageTypeCode(sText: string): string {
        if (!sText) {
            return "";
        }

        const aParts = sText.split(" - ");

        if (aParts.length > 0) {
            return aParts[0].trim();
        }

        return "";
    }

    private onGetPathMaterial(oEvent: Input$ValueHelpRequestEvent): void {
        const oSource: Input = oEvent.getSource();
        const oBindingContext = oSource.getBindingContext("mContractManagement") as ContextV2;
        this.sPahtMaterial = oBindingContext.getPath();
    }

    public async onOpenPopUpMaterial(oEvent: Input$ValueHelpRequestEvent): Promise<void> {
        this.onGetPathMaterial(oEvent);
        this.oFragmentMaterial ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblMaterial",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentMaterial);
        this.oFragmentMaterial.open();
    }

    public onSearchMaterial(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("Material", FilterOperator.Contains, sValue),
                new Filter("Description", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    // public onSelectMaterial(oEvent: TableSelectDialog$ConfirmEvent): void {
    //     const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];

    //     if (this.sPahtMaterial) {
    //         const sPathMaterial = this.sPahtMaterial;

    //         for (const oSelect of oSelectedContext) {
    //             const oMaterialSelected = oSelect.getObject();
    //             this.oContractManagement.setProperty(`${sPathMaterial}/oMaterial`, oMaterialSelected);
    //             this._applyCustomerGroup1ByMaterial(sPathMaterial, oMaterialSelected);
    //         }

    //         this.sPahtMaterial = "";
    //         this.oContractManagement.refresh(true);
    //         this._markAsDirty();
    //     }
    // }


    public onSelectMaterial(oEvent: TableSelectDialog$ConfirmEvent): void {
    const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];

    if (this.sPahtMaterial) {
        const sPathMaterial = this.sPahtMaterial;

        for (const oSelect of oSelectedContext) {
            const oMaterialSelected = oSelect.getObject();
            // Asignamos el material al modelo
            this.oContractManagement.setProperty(`${sPathMaterial}/oMaterial`, oMaterialSelected);
            
            // NUEVO: En lugar de aplicar la cobertura directo, lanzamos la pregunta
            this._askPostventa(sPathMaterial, oMaterialSelected);
        }

        this.sPahtMaterial = "";
        this.oContractManagement.refresh(true);
        this._markAsDirty();
    }
}

private _askPostventa(sPathMaterial: string, oMaterialSelected: any): void {
    MessageBox.confirm("¿Este material corresponde a una Postventa?", {
        title: "Confirmación de Postventa",
        actions: [MessageBox.Action.YES, MessageBox.Action.NO],
        emphasizedAction: MessageBox.Action.YES,
        onClose: (oAction: string) => {
            if (oAction === MessageBox.Action.YES) {
                // Si dice que SÍ: Forzamos el valor a "PSV" (Postventa) y bloqueamos el campo
                this.oContractManagement.setProperty(`${sPathMaterial}/selectedCustomerGroup1`, "PSV");
                this.oContractManagement.setProperty(`${sPathMaterial}/isCustomerGroup1Locked`, true);
            } else {
                // Si dice que NO: Ejecutamos tu lógica original de autollenado
                this._applyCustomerGroup1ByMaterial(sPathMaterial, oMaterialSelected);
            }
            
            // Refrescamos el modelo para que la vista refleje el cambio de la cobertura y se marque como sucio el form
            this.oContractManagement.refresh(true);
            this._markAsDirty();
        }
    });
}

    private _normalizeText(value: string): string {
        return (value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toUpperCase();
    }

    private _getCustomerGroup1ByMaterial(oMaterialSelected: any): string | null {
        const sDescription = this._normalizeText(oMaterialSelected?.Description || "");

        if (sDescription.includes("COBERTURA BASICA")) {
            return "BAS";
        }
        if (sDescription.includes("COBERTURA EXPRESS")) {
            return "EXP";
        }
        if (sDescription.includes("COBERTURA COMPLETA")) {
            return "FUL";
        }
        if (sDescription.includes("COBERTURA MEDIA")) {
            return "MED";
        }
        if (sDescription.includes("COBERTURA SEMI")) {
            return "SEM";
        }

        return null;
    }

    private _applyCustomerGroup1ByMaterial(sPathMaterial: string, oMaterialSelected: any): void {
        const sCustomerGroup1 = this._getCustomerGroup1ByMaterial(oMaterialSelected);

        if (sCustomerGroup1) {
            this.oContractManagement.setProperty(`${sPathMaterial}/selectedCustomerGroup1`, sCustomerGroup1);
            this.oContractManagement.setProperty(`${sPathMaterial}/isCustomerGroup1Locked`, true);
        } else {
            this.oContractManagement.setProperty(`${sPathMaterial}/selectedCustomerGroup1`, null);
            this.oContractManagement.setProperty(`${sPathMaterial}/isCustomerGroup1Locked`, false);
        }
    }

    public async onOpenPopUpCebe(oEvent: Input$ValueHelpRequestEvent): Promise<void> {
        this.onGetPathMaterial(oEvent);
        this.oFragmentCabe ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblCebe",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentCabe);
        this.oFragmentCabe.open();
    }

    public onSearchCebe(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("Profit", FilterOperator.Contains, sValue),
                new Filter("Description", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectCebe(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        if (this.sPahtMaterial) {
            for (const oSelect of oSelectedContext) {
                this.oContractManagement.setProperty(`${this.sPahtMaterial}/oCebe`, oSelect.getObject());
                this.sPahtMaterial = "";
            }
            this._markAsDirty();
        }
    }

    public async onOpenPopUpOrderReason(oEvent: Input$ValueHelpRequestEvent): Promise<void> {
        this.onGetPathMaterial(oEvent);
        this.oFragmentOrderReason ??= await Fragment.load({
            id: this.getView()?.getId(),
            name: "contractmanagement.contractmanagement.view.fragment.TblOrderReason",
            controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this.oFragmentOrderReason);
        this.oFragmentOrderReason.open();
    }

    public onSearchOrderReason(oEvent: TableSelectDialog$SearchEvent): void {
        const sValue: string = oEvent.getParameter("value") || "";
        const oFilter = new Filter({
            filters: [
                new Filter("Reason", FilterOperator.Contains, sValue),
                new Filter("Description", FilterOperator.Contains, sValue)
            ],
            and: false
        });
        const oBinding = oEvent.getSource().getBinding("items") as ODataListBinding;
        oBinding.filter([oFilter]);
    }

    public onSelectOrderReason(oEvent: TableSelectDialog$ConfirmEvent): void {
        const oSelectedContext = oEvent.getParameter("selectedContexts") as ContextV2[];
        if (this.sPahtMaterial) {
            for (const oSelect of oSelectedContext) {
                this.oContractManagement.setProperty(`${this.sPahtMaterial}/oOrderReason`, oSelect.getObject());
                this.sPahtMaterial = "";
            }
            this._markAsDirty();
        }
    }

    public onAssignEquipment(): void {
        BusyIndicator.show(0);
        try {
            this._onValidateData();
            this.oContractManagement.setProperty("/arrEquipment", []);
            this.oContractManagement.setProperty("/isEquipmentCup", false);
            this._onEquipment();
        } catch (oError: any) {
            MessageBox.error(oError.message);
        } finally {
            BusyIndicator.hide();
        }
    }

    private _onEquipment(): void {
    console.log("=== _onEquipment ===");
    console.log("materialPositions enviados:", this.arrIndexSelectRowMaterial);
    console.log("fromTarget enviado:", "TargetMain");

    this.oRouter.getTargets()?.display("TargetEquipment", {
        materialPositions: this.arrIndexSelectRowMaterial,
        fromTarget: "TargetMain"
    });
}

    private _onValidateData(): void {
        const oRequester: Customer = this.oContractManagement.getProperty("/header/oRequester");
        if (this.arrIndexSelectRowMaterial.length === 0) {
            throw new Error(this.oI18n.getText("errorAddEquipment") ?? "");
        }
        if (!oRequester) {
            throw new Error(this.oI18n.getText("errorCustomer"));
        }
    }

    public showEquipment(oEvent: Button$PressEvent, _toCup = false): void {
        const oSource: Button = oEvent.getSource();
        const oBinding = oSource.getBindingContext("mContractManagement") as ContextV2;
        const sPath: string = oBinding.getPath();
        const oMaterial: Items = this.oContractManagement.getProperty(sPath);

        for (const oEquipment of oMaterial.arrEquipment) {
            if (_toCup && !oEquipment.cup) {
                oEquipment.cup = 0;
            }
        }

        this.oContractManagement.setProperty("/arrEquipment", oMaterial.arrEquipment);
        this.oContractManagement.setProperty("/isEquipmentCup", _toCup);
        this._onEquipment();
    }

    public async onSave(): Promise<void> {
        try {
            BusyIndicator.show(0);
            this._onValidateDataSave();

            const oHeader: Header = this.oContractManagement.getProperty("/header");
            const oQuotationHeaderIn: QuotationHeaderIn = this._headerIn();
            const oItemsAndDataSet: ItemsAndData = this._itemsAndData();

            const oJsonCreate: Create_Quotation = {
                QuotationDataInSet: oItemsAndDataSet.quotationData,
                QuotationHeaderIn: oQuotationHeaderIn,
                Return: [],
                QuotationItemsInSet: oItemsAndDataSet.quotationItems,
                QuotationPartnersSet: [
                    {
                        PartnNumb: oHeader.oRequester?.CustomerCode || "",
                        PartnRole: "AG"
                    },
                    {
                        PartnNumb: oHeader.oShipTo?.CustomerCode || "",
                        PartnRole: "WE"
                    }
                ]
            };

            const { data: oResponse } = await ERP.createDataERP(
                "/QuotationHeaderSet",
                this.ZSD_CREATE_QUOTATION_CUSTOMER_SRV,
                oJsonCreate
            );

            const aReturnMessages = oResponse.Return.results;
            let sSalesDocument: string | undefined;

            if (aReturnMessages && aReturnMessages.length > 0) {
                const oLastMessage = aReturnMessages[aReturnMessages.length - 1];
                const sMessage = oLastMessage.Message;
                const regex = /(\d{8,})/;
                const match = sMessage.match(regex);

                if (match && match[1]) {
                    sSalesDocument = match[1];
                }
            }

            if (sSalesDocument) {
                MessageBox.success(
                    this.oI18n.getText("successSave", [sSalesDocument]) ||
                    "Oferta creada con éxito, pero el número de documento no pudo ser extraído.",
                    {
                        onClose: () => {
                            this._isDirty = false;
                            this._initDefaultData();
                        }
                    }
                );
            }
        } catch (oError: any) {
            if (oError.statusCode === "400") {
                this._onErrorMessageERP(JSON.parse(oError.responseText));
            } else {
                MessageBox.error(oError.message);
            }
        } finally {
            BusyIndicator.hide();
        }
    }

    private _onValidateDataSave(): void {
        const arrMaterial: Items[] = this.oContractManagement.getProperty("/arrMaterial");
        const oFoundNotEquipment = arrMaterial.find(oMaterial => oMaterial.arrEquipment.length === 0);

        if (arrMaterial.length === 0) {
            throw new Error(this.oI18n.getText("errorMaterialAdd"));
        }
        if (oFoundNotEquipment) {
            throw new Error(this.oI18n.getText("errorSave"));
        }
    }

    private _headerIn(): QuotationHeaderIn {
        const oHeader: Header = this.oContractManagement.getProperty("/header");

        return {
            CompCdeB: oHeader.oSalesOrganization?.Vkorg || "",
            Currency: oHeader.oCurrency?.CurrencyCode || "",
            DistrChan: oHeader.oChannel?.Vtweg || "",
            Division: oHeader.oSector?.Spart || "",
            PymtMeth: oHeader.paymentMethod || "",
            Pmnttrms: oHeader.paymentTerms || "",
            DocType: oHeader.oOfferType?.Auart || "",
            PurchNoC: oHeader.customerOrder || "",
            SalesGrp: oHeader.oSalesGroup?.Group || "",
            SalesOff: oHeader.oSalesOffice?.Office || "",
            SalesOrg: oHeader.oSalesOrganization?.Vkorg || "",
            ReqDateH: oHeader.orderDate || "",
            CtValidF: oHeader.validFromDate || "",
            CtValidT: oHeader.validUntilDate || "",
            QtValidF: oHeader.validFromDateQuo || "",
            QtValidT: oHeader.validUntilDateQuo || "",
            CustGrp1: oHeader.oType?.Name || "",
            CustGrp2: oHeader.oContractType?.Name || "",
        };
    }

    private _itemsAndData(): ItemsAndData {
        const oHeader: Header = this.oContractManagement.getProperty("/header");
        const arrMaterial: Items[] = this.oContractManagement.getProperty("/arrMaterial");

        const arrQuotationItemsInSet: QuotationItemsInSet[] = [];
        const arrQuotationDataInSet: QuotationDataInSet[] = [{
            ItmNumber: "0".padStart(6, "0"),
            ValPer: "",
            ValPerCa: "",
            ValPerUn: "",
            InstDate: new Date("0000000000000"),
            AcceptDat: new Date("0000000000000"),
            ConStDat: oHeader.validFromDate || "",
            ConSiDat: new Date("0000000000000"),
            ConEnDat: oHeader.validUntilDate || "",
            ActDatrul: "",
            CancDoc: "",
            CancParty: "",
            CancProc: "",
            Cancreason: "",
            ConEnAct: "",
            ConEnRul: "",
            ConStRul: ""
        }];

        for (let i = 0; i < arrMaterial.length; i++) {
            const oMaterial = arrMaterial[i];
            const iPosition: string = ((i + 1) * 10).toString();

            const oEquipmentAndWorkForce: EquipmentByWorkForce = this._equipmentAndWorForce(
                oMaterial.arrEquipment,
                oHeader.oCurrency?.CurrencyCode || "",
                iPosition
            );

            const oQuotationItemsInSet: QuotationItemsInSet = {
                Currency: oHeader.oCurrency?.CurrencyCode || "",
                Division: oHeader.oSector?.Spart || "",
                ItmNumber: iPosition.padStart(6, "0"),
                Material: oMaterial.oMaterial?.Material || "",
                Plant: oMaterial.selectedKeyCenter || "",
                PrcGroup1: oMaterial.selectedCustomerGroup1 || "",
                PrcGroup2: oMaterial.selectedCustomerGroup3 || "",
                PrcGroup3: oMaterial.selectedWorkingHours || "",
                PrcGroup4: oMaterial.selectedCustomerGroup4 || "",
                PrcGroup5: oMaterial.selectedCustomerGroup5  || "",
                CustGroup: oMaterial.selectedUsageType || "",
                ProfitCtr: oMaterial.oCebe?.Profit || "",
                CustMat35: oEquipmentAndWorkForce.arrEquipment?.[0]?.Equipment || "",
                TargetQty: "1",
                TargetQu: "SR",
                TargetVal: oMaterial.netValue.toString(),
                QuotationConditionsInSet: oEquipmentAndWorkForce.arrWorkForce,
                QuotationEquipmentInSet: oEquipmentAndWorkForce.arrEquipment
            };

            const oQuotationDataInSet: QuotationDataInSet = {
                ItmNumber: iPosition.padStart(6, "0"),
                ValPer: "",
                ValPerCa: "",
                ValPerUn: "",
                InstDate: oEquipmentAndWorkForce.arrEquipment[0]?.InstalationDate || new Date("0000000000000"),
                AcceptDat: new Date("0000000000000"),
                ConStDat: oMaterial.validFromDate || "",
                ConSiDat: new Date("0000000000000"),
                ConEnDat: oMaterial.validUntilDate || "",
                ActDatrul: "",
                CancDoc: "",
                CancParty: "",
                CancProc: "",
                Cancreason: "",
                ConEnAct: "",
                ConEnRul: "",
                ConStRul: ""
            };

            arrQuotationItemsInSet.push(oQuotationItemsInSet);
            arrQuotationDataInSet.push(oQuotationDataInSet);
        }

        return {
            quotationItems: arrQuotationItemsInSet,
            quotationData: arrQuotationDataInSet
        };
    }

    private _equipmentAndWorForce(arrEquipment: ItemEquipment[], sCurrency: string, sParentItemNumber: string): EquipmentByWorkForce {
        const arrQuotationEquipmentInSet: QuotationEquipmentInSet[] = [];
        const arrQuotationConditionsInSet: QuotationConditionsInSet[] = [];
        const sItemNumberFormatted = sParentItemNumber.padStart(6, "0");

        for (let i = 0; i < arrEquipment.length; i++) {
            const oEquipment = arrEquipment[i];
            const arrWorkForce = oEquipment.workForce as WorkForce[] || [];

            const oQuotationEquipmentInSet: QuotationEquipmentInSet = {
                ItmNumber: sItemNumberFormatted,
                Equipment: oEquipment.EquipmentB || "",
                InstalationDate: oEquipment.InstalationDate || ""
            };
            arrQuotationEquipmentInSet.push(oQuotationEquipmentInSet);

            for (const oWorkForce of arrWorkForce) {
                let sCondType = "";

                if (oWorkForce.key === "06") {
                    sCondType = "ZVKP";
                } else {
                    sCondType = oWorkForce.key;
                }

                if (sCondType && oWorkForce.monthly >= 0) {
                    const oQuotationConditionsInSet: QuotationConditionsInSet = {
                        ItmNumber: sItemNumberFormatted,
                        CondPUnt: "1",
                        CondType: sCondType,
                        CondUnit: "SR",
                        CondValue: oWorkForce.monthly.toString(),
                        Currency: sCurrency
                    };

                    arrQuotationConditionsInSet.push(oQuotationConditionsInSet);
                }
            }
        }

        return {
            arrEquipment: arrQuotationEquipmentInSet,
            arrWorkForce: arrQuotationConditionsInSet
        };
    }

    private _onErrorMessageERP(jsonErrorERP: any): void {
        const oError = jsonErrorERP.error;
        const oMessage = oError.message;
        MessageBox.error(oMessage.value);
    }

    private _initDefaultData(): void {
        const oToday = new Date();

        const oInitialHeader: Header = {
            orderDate: oToday,
            oType: { Name: "CO", Description: "Contrato" },
            oOfferType: { Auart: "AV", Bezei: "Oferta p.contrato" },
            oSalesOrganization: { Vkorg: "MEL1", Vtext: "Mitsubishi Electric" },
            oChannel: { Vtweg: "NA", Vtext: "Canal Nacional" },
            oSector: { Spart: "MS", Vtext: "MaintenanceServiceC" },
            oCurrency: { CurrencyCode: "MXN", CurrencyName: "Pesos mexicanos" },
            customerOrder: null,
            department: null,
            oContractType: null,
            oRequester: null,
            oShipTo: null,
            oSalesGroup: null,
            oSalesOffice: null,
            paymentMethod: null,
            paymentTerms: null,
            validFromDate: null,
            validUntilDate: null,
            validFromDateQuo: null,
            validUntilDateQuo: null
        };

        this.oContractManagement.setProperty("/header", oInitialHeader);
        this.oContractManagement.setProperty("/arrMaterial", []);
        this.oContractManagement.setProperty("/arrEquipment", []);
        this.oContractManagement.setProperty("/oConfig/isEditableEquipment", true);
        this.oContractManagement.setProperty("/isEquipmentCup", true);
        this.oContractManagement.setProperty("/arrWorkForce", []);
        this._isDirty = false;
    }

    public onClear(): void {
        const oHeader: Header = {
            customerOrder: null,
            department: null,
            oChannel: null,
            oCurrency: null,
            oType: null,
            oContractType: null,
            oOfferType: null,
            orderDate: null,
            oRequester: null,
            oShipTo: null,
            oSalesGroup: null,
            oSalesOffice: null,
            oSalesOrganization: null,
            oSector: null,
            paymentMethod: null,
            paymentTerms: null,
            validFromDate: null,
            validUntilDate: null,
            validFromDateQuo: null,
            validUntilDateQuo: null
        };

        this.oContractManagement.setProperty("/header", oHeader);
        this.oContractManagement.setProperty("/arrMaterial", []);
        this.oContractManagement.setProperty("/arrEquipment", []);
        this.oContractManagement.setProperty("/oConfig/isEditableEquipment", true);
        this.oContractManagement.setProperty("/isEquipmentCup", true);
        this.oContractManagement.setProperty("/arrWorkForce", []);
        this._isDirty = false;
    }
}