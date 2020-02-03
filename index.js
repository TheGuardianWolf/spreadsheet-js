'use strict';

const sleep = (milliseconds) => {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
};

const numberToAlpha = (number) => {
    number -= 1;

    let padA = Math.floor(number / 26);

    let alpha = '';
    for (let i = 0; i < padA; i++) {
        alpha += 'A';
    }
    
    return alpha + String.fromCharCode(65 + number - padA * 26);
};

class Size {
    /**
     * Constructor
     * @param {Number} rows 
     * @param {Number} cols 
     */
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
    }
}

class Position {
    /**
     * 
     * @param {Number} row 
     * @param {Number} col 
     */
    constructor(row, col) {
        this.row = row;
        this.col = col;
    }

    toString() {
        return `${numberToAlpha(this.col)}${this.row}`;
    }
}

class DOMHelper {
    static createRowElement(isHeader) {
        let element = document.createElement('div');
        element.classList.add('cell-row');
        if (isHeader) {
            element.classList.add('header-row');
        }
        return element;
    }

    static createCellElement(isHeader) {
        let wrapper = document.createElement('div');
        wrapper.classList.add('cell-wrapper');
        let cell = document.createElement('div');
        cell.classList.add('cell');
        if (isHeader) {
            cell.classList.add('header-cell');
        }
        let cellInput = document.createElement('input');
        cellInput.type = 'text';
        if (isHeader) {
            cellInput.setAttribute('readonly', true);
        }

        wrapper.appendChild(cell);
        cell.appendChild(cellInput);
        return wrapper;
    }
}

class Cell {
    
    /**
     * 
     * @param {Spreadsheet} spreadsheet
     * @param {Number} id 
     * @param {HTMLElement} cellElement 
     */
    constructor(spreadsheet, id, cellElement) {
        this.spreadsheet = spreadsheet;
        this.id = id;
        this.element = cellElement;
        this.data = '';
        this.displayValue = '';
        this.attributes = {
            'bold': false,
            'italics': false,
            'underline': false,
        };
        this.dataType = 'text';
        this.textChanged = false;
        this.propergatesTo = [];
    }

    getAttribute(attr) {
        return this.attributes[attr];
    }

    setAttribute(attr, val) {
        if (val !== this.attributes[attr]) {
            this.attributes[attr] = val;
            if (val) {
                this.inputField.classList.add(attr);
            }
            else {
                this.inputField.classList.remove(attr);
            }
        }
    }

    get inputField() {
        return this.element.firstChild.firstChild;
    }

    get inputValue() {
        let value = this.inputField.value;
        return value == null ? null : value;  // Null or undefined returns null
    }

    set inputValue(val) {
        if (!(val == null)) {  // Null or undefined check
            this.inputField.value = String(val);
        }
    }

    get cell() {
        return this.element.firstChild;
    }

    init() {
        this.inputField.addEventListener('blur', () => {
            if (this.textChanged) {
                this.store(this.inputValue);
                this.textChanged = false;
            }
            else {
                this.inputValue = this.displayValue;
            }
        });

        this.inputField.addEventListener('keypress', (e) => {
            let keyCode = e.which;
            if (keyCode === 13) {
                this.inputField.blur();
            }
            else {
                this.textChanged = true;
            }
        });

        this.inputField.addEventListener('focus', () => {
            if (this.dataType === 'equation') {
                this.inputValue = this.data;
            }

            let prevActiveCell = this.spreadsheet.activeCell;
            if (!(prevActiveCell == null)) {
                prevActiveCell.cell.classList.remove('active-cell');
            }
            this.cell.classList.add('active-cell');
            this.spreadsheet.activeCell = this;
        });
    }

    store(data) {
        let text = String(data);
        this.dataType = Cell.inferType(text);
        if (this.dataType === 'text') {
            this.data = text;
            this.displayValue = text;
            console.log(this);
            console.log(`Storing ${this.data}.`);
        }
        else if (this.dataType === 'equation') {
            this.data = text;
            this.displayValue = String(this.resolveEquation(text.slice(1, text.length)));
        }

        this.inputValue = this.displayValue;
    }

    resolveEquation(equation) {
        let parts = equation.split('+');

        let sum = 0;
        if (parts.length > 1) {
            for (let i = 0; i < parts.length; i++) {
                console.log(this.spreadsheet.cells[parts[i]].data);
                sum += Number.parseFloat(this.spreadsheet.cells[parts[i]].data);
            }
        }

        return sum;
    }

    static inferType(text) {
        // console.log(text.slice(0, 1));
        if (text.slice(0, 1) === '=') {
            return 'equation';
        }
        else {
            return 'text';
        }
    }
    
}

class Spreadsheet {
    /**
     * 
     * @param {Size} size 
     */
    constructor(size) {
        this.initialised = false;
        this.loading = false;
        this.cleared = true;
        this.clearing = false;
        this.loadingScreen = null;
        this.cellContainer = null;
        this.buttonReload = null;
        this.buttonBold = null;
        this.buttonItalics = null;
        this.buttonUnderline = null; 

        this.cornerCell = null;
        this.rowHeaderCells = [];
        this.columnHeaderCells = [];
        this.cells = {};
        this.lut = {};
        this.size = new Size(size.rows, size.cols);
        this.activeCell = null;
        this.prevCellId = 0;
    }

    setLoading(status) {
        if (status != this.loading) {
            this.loading = status;
            if (status) {
                this.cellContainer.classList.add('not-visible');
                this.loadingScreen.classList.remove('not-visible');
            }
            else {
                this.loadingScreen.classList.add('not-visible');
                this.cellContainer.classList.remove('not-visible');
            }
        }
    }

    generateCellId() {
        let cellId = this.prevCellId;
        this.prevCellId++;
        return cellId;
    }

    async init() {
        this.loadingScreen = document.getElementById('spreadsheet-loading');

        this.cellContainer = document.getElementById('spreadsheet-content');

        this.buttonClear = document.getElementById('spreadsheet-functions-clear');
        this.buttonClear.addEventListener('click', () => {
            this.clear();
        });
        this.buttonReload = document.getElementById('spreadsheet-functions-reload');
        this.buttonReload.addEventListener('click', () => {
            this.redraw();
        });

        this.buttonBold = document.getElementById('spreadsheet-formatting-bold');
        this.buttonBold.addEventListener('click', () => {
            this.activeCell.setAttribute('bold', !this.activeCell.getAttribute('bold'));
        });
        this.buttonItalics = document.getElementById('spreadsheet-formatting-italics');
        this.buttonItalics.addEventListener('click', () => {
            this.activeCell.setAttribute('italics', !this.activeCell.getAttribute('italics'));
        });
        this.buttonUnderline = document.getElementById('spreadsheet-formatting-underline');
        this.buttonUnderline.addEventListener('click', () => {
            this.activeCell.setAttribute('underline', !this.activeCell.getAttribute('underline'));
        });

        // Put this corner cell in to fill in the top left of the table
        this.cornerCell = new Cell(this, this.generateCellId(), DOMHelper.createCellElement(true));
        this.cornerCell.cell.classList.add('corner-cell');
        this.cornerCell.init();

        // Fill in the header row
        for (let i = 1; i <= this.size.cols; i++) {
            let cell = new Cell(this, this.generateCellId(), DOMHelper.createCellElement(true));
            cell.init();
            cell.store(numberToAlpha(i));
            this.columnHeaderCells.push(cell);
        }
        await sleep(1); // Allow browser to catch up

        // Generate the rest of the rows
        for (let i = 1; i <= this.size.rows; i++) {
            // First cell of each row is the row header
            let cell = new Cell(this, this.generateCellId(), DOMHelper.createCellElement(true));
            cell.init();
            cell.store(String(i));
            this.rowHeaderCells.push(cell);

            // Generate each column
            for (let j = 1; j <= this.size.cols; j++) {
                let position = new Position(i, j);
                let cell = new Cell(this, this.generateCellId(), DOMHelper.createCellElement());
                cell.init();
                this.cells[position] = cell;
            }
            await sleep(1); // Allow browser to catch up
        }
        this.initialised = true;
    }

    async redraw() {
        if (!this.initialised || this.loading || this.clearing) {
            return;
        }

        this.setLoading(true);
        await this.clear();
        // Same process as init

        // Headers first
        // Fill in the header row
        let headerRow = DOMHelper.createRowElement(true);
        headerRow.appendChild(this.cornerCell.element);
        for (let i = 0; i < this.size.cols; i++) {
            headerRow.appendChild(this.columnHeaderCells[i].element);
        }
        this.cellContainer.appendChild(headerRow);
        await sleep(1); // browser catch up

        // Put in rest of the rows
        for (let i = 1; i <= this.size.rows; i++) {
            let row = DOMHelper.createRowElement();
            row.appendChild(this.rowHeaderCells[i - 1].element);

            // Generate each column
            for (let j = 1; j <= this.size.cols; j++) {
                row.appendChild(this.cells[new Position(i, j)].element);
            }
            this.cellContainer.appendChild(row);
            await sleep(1); // browser catch up
        }
        this.cleared = false;
        this.setLoading(false);
    }

    async clear() {
        if (!this.initialised || this.cleared || this.clearing) {
            return;
        }
        let wasLoading = this.loading; 
        this.clearing = true;
        if (!wasLoading) {
            this.setLoading(true);
        }
        while (this.cellContainer.children.length > 0) {
            this.cellContainer.removeChild(this.cellContainer.children[this.cellContainer.children.length - 1]);
            await sleep(1); // browser catch up
        }
        if (!wasLoading) {
            this.setLoading(false);
        }
        this.clearing = false;
        this.cleared = true;
    }
}

const contentLoaded = new Promise((resolve) => {
    if (document.readyState == 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
    }
    else {
        resolve();
    }
});

let spreadsheet = null;

const main = async () => {
    spreadsheet = new Spreadsheet(new Size(100, 100)); 
    await contentLoaded;
    console.log('DOM Loaded');
    await spreadsheet.init();
    await spreadsheet.redraw();
};

main();
